const db = require('./database');
const redis = require('./redis');
const stateMachine = require('./conversation-states');
const twilioService = require('./twilio-client');
const vapiService = require('./vapi-client');
const logger = require('./logger');

class SMSHandler {
  async handleIncomingSMS(phoneNumber, message) {
    try {
      logger.info('Incoming SMS received', { phoneNumber, message, messageLength: message.length });
      
      // Log incoming message (works for both SMS and Telegram)
      await db.logSMS(phoneNumber, 'inbound', message);
      
      // Check rate limiting
      const rateLimit = await redis.checkRateLimit(phoneNumber);
      logger.debug('Rate limit check', { phoneNumber, rateLimit });
      if (!rateLimit.allowed) {
        logger.warn('Rate limit exceeded', { phoneNumber, remainingTime: rateLimit.remainingTime });
        return "You've sent too many messages. Please try again later.";
      }
      
      // Get or create user (phoneNumber can be actual phone or telegram_chatId)
      const user = await db.createOrGetUser(phoneNumber);
      logger.debug('User fetched/created', { userId: user.id, phoneNumber: user.phone_number, isNew: user.created_at === user.updated_at });
      
      // Check if user wants to start fresh
      const normalizedMessage = message.toLowerCase().trim();
      
      // Reset command for testing
      if (normalizedMessage === 'reset' || normalizedMessage === '/reset') {
        logger.info('Reset command received', { phoneNumber });
        const existingConversation = await redis.getConversationState(phoneNumber);
        if (existingConversation) {
          await this.cancelConversation(phoneNumber, existingConversation.id);
        }
        return "Conversation reset. Text 'start' to begin a new conversation.";
      }
      
      if (normalizedMessage === 'start' || normalizedMessage === '/start' || normalizedMessage === 'hello' || normalizedMessage === 'hi') {
        logger.info('Start command received, checking for existing conversation', { phoneNumber });
        // Get any existing conversation
        const existingConversation = await redis.getConversationState(phoneNumber);
        if (existingConversation && (existingConversation.state === 'cancelled' || existingConversation.state === 'completed')) {
          logger.info('Clearing cancelled/completed conversation', { conversationId: existingConversation.id, state: existingConversation.state });
          await this.cancelConversation(phoneNumber, existingConversation.id);
        }
        if (existingConversation && existingConversation.state !== 'initial') {
          logger.info('User restarting active conversation', { conversationId: existingConversation.id, previousState: existingConversation.state });
          await this.cancelConversation(phoneNumber, existingConversation.id);
        }
        return await this.startNewConversation(user, phoneNumber, message);
      }
      
      // Get conversation from Redis first (faster)
      let conversation = await redis.getConversationState(phoneNumber);
      logger.debug('Redis conversation lookup', { phoneNumber, found: !!conversation, state: conversation?.state });
      
      // If not in Redis, check database
      if (!conversation) {
        const dbConversation = await db.getActiveConversation(user.id);
        logger.debug('Database conversation lookup', { userId: user.id, found: !!dbConversation });
        if (dbConversation) {
          conversation = {
            id: dbConversation.id,
            state: dbConversation.state,
            data: dbConversation.current_data
          };
          // Store in Redis for faster access
          await redis.setConversationState(phoneNumber, conversation);
          logger.debug('Conversation restored to Redis', { conversationId: conversation.id, state: conversation.state });
        }
      }
      
      // Handle based on current state
      if (!conversation) {
        // New conversation
        logger.info('Starting new conversation', { userId: user.id, phoneNumber });
        return await this.startNewConversation(user, phoneNumber, message);
      } else {
        // Continue existing conversation
        logger.info('Continuing existing conversation', { 
          conversationId: conversation.id, 
          currentState: conversation.state,
          phoneNumber 
        });
        return await this.continueConversation(user, phoneNumber, conversation, message);
      }
      
    } catch (error) {
      logger.error('SMS handler error', { error: error.message, stack: error.stack, phoneNumber });
      return "Sorry, something went wrong. Please try again or text 'start' to begin a new conversation.";
    }
  }
  
  async startNewConversation(user, phoneNumber, message) {
    // Check for keywords
    const lowerMessage = message.toLowerCase().trim();
    logger.debug('Processing new conversation message', { userId: user.id, message: lowerMessage });
    
    if (lowerMessage === 'help') {
      logger.info('Help command received', { userId: user.id });
      return "Welcome to OldVoice! I help you record conversations with loved ones.\n\n" +
             "Text 'start' to begin setting up a call.\n" +
             "Text 'status' to check your recordings.\n" +
             "Text 'cancel' to stop current setup.";
    }
    
    if (lowerMessage === 'status') {
      logger.info('Status command received', { userId: user.id, totalRecordings: user.total_recordings });
      return `You have ${user.total_recordings} recorded conversations. Text 'start' to record a new one!`;
    }
    
    if (lowerMessage === 'start' || lowerMessage === 'hello' || lowerMessage === 'hi') {
      // Create new conversation
      logger.info('Creating new conversation', { userId: user.id, trigger: lowerMessage });
      const newConversation = await db.createConversation(user.id, stateMachine.states.INITIAL, {
        storyteller: {},
        questions: [],
        avoid_topics: []
      });
      
      const conversation = {
        id: newConversation.id,
        state: newConversation.state,
        data: newConversation.current_data
      };
      
      await redis.setConversationState(phoneNumber, conversation);
      logger.info('New conversation created', { 
        conversationId: conversation.id, 
        userId: user.id,
        initialState: conversation.state 
      });
      
      return stateMachine.getPrompt(stateMachine.states.INITIAL);
    }
    
    logger.debug('Unknown command, sending default message', { userId: user.id, message: lowerMessage });
    return "Hi! I'm OldVoice. I help you record conversations with your loved ones. Text 'start' to begin!";
  }
  
  async continueConversation(user, phoneNumber, conversation, message) {
    const currentState = conversation.state;
    const lowerMessage = message.toLowerCase().trim();
    logger.debug('Processing conversation continuation', { 
      conversationId: conversation.id,
      currentState,
      userInput: message 
    });
    
    // Check for cancel
    if (lowerMessage === 'cancel' || lowerMessage === 'stop') {
      logger.info('User cancelled conversation', { conversationId: conversation.id, trigger: lowerMessage });
      await this.cancelConversation(phoneNumber, conversation.id);
      return "Conversation setup cancelled. Text 'start' to begin again.";
    }
    
    // Validate input
    const isValid = stateMachine.validateInput(currentState, message);
    logger.debug('Input validation', { 
      conversationId: conversation.id,
      currentState, 
      isValid,
      userInput: message 
    });
    if (!isValid) {
      const errorMessage = stateMachine.getError(currentState);
      logger.warn('Invalid input received', { 
        conversationId: conversation.id,
        currentState, 
        userInput: message,
        errorMessage 
      });
      return errorMessage;
    }
    
    // Transform and store input
    const transformedInput = stateMachine.transformInput(currentState, message, conversation.data);
    logger.debug('Input transformation', { 
      conversationId: conversation.id,
      currentState,
      originalInput: message,
      transformedInput 
    });
    this.updateConversationData(conversation.data, currentState, transformedInput);
    
    // Get next state
    const nextState = stateMachine.getNextState(currentState, message);
    logger.info('State transition', { 
      conversationId: conversation.id,
      fromState: currentState,
      toState: nextState,
      trigger: message 
    });
    
    if (!nextState) {
      logger.error('No next state found', { conversationId: conversation.id, currentState, userInput: message });
      await this.cancelConversation(phoneNumber, conversation.id);
      return "Something went wrong. Please text 'start' to begin again.";
    }
    
    // Handle completion
    if (nextState === stateMachine.states.COMPLETED) {
      logger.info('Conversation reached completion state', { conversationId: conversation.id });
      return await this.completeConversation(user, phoneNumber, conversation);
    }
    
    // Handle cancellation
    if (nextState === stateMachine.states.CANCELLED) {
      logger.info('Conversation cancelled by state machine', { conversationId: conversation.id });
      await this.cancelConversation(phoneNumber, conversation.id);
      return "Setup cancelled. Text 'start' to try again.";
    }
    
    // Update conversation state
    conversation.state = nextState;
    await redis.setConversationState(phoneNumber, conversation);
    await db.updateConversation(conversation.id, nextState, conversation.data);
    logger.info('Conversation state updated', { 
      conversationId: conversation.id,
      newState: nextState,
      dataKeys: Object.keys(conversation.data) 
    });
    
    // Get next prompt
    const nextPrompt = stateMachine.getPrompt(nextState, conversation.data);
    logger.debug('Next prompt generated', { 
      conversationId: conversation.id,
      state: nextState,
      promptLength: nextPrompt.length 
    });
    return nextPrompt;
  }
  
  updateConversationData(data, state, input) {
    logger.debug('Updating conversation data', { state, inputType: typeof input });
    switch (state) {
      case stateMachine.states.COLLECTING_NAME:
        data.storyteller.name = input;
        logger.debug('Storyteller name collected', { name: input });
        break;
      case stateMachine.states.COLLECTING_PHONE:
        data.storyteller.phone = input;
        logger.debug('Storyteller phone collected', { phone: input });
        break;
      case stateMachine.states.COLLECTING_RELATIONSHIP:
        data.storyteller.relationship = input;
        logger.debug('Relationship collected', { relationship: input });
        break;
      case stateMachine.states.COLLECTING_PERSONALITY:
        data.storyteller.personality = input;
        logger.debug('Personality collected', { personalityLength: input.length });
        break;
      case stateMachine.states.COLLECTING_BACKGROUND:
        data.storyteller.background = input;
        logger.debug('Background collected', { backgroundLength: input.length });
        break;
      case stateMachine.states.COLLECTING_QUESTIONS:
        data.questions = input;
        logger.debug('Questions collected', { questionCount: input.length });
        break;
      case stateMachine.states.COLLECTING_MORE_QUESTIONS:
        data.questions = input;
        logger.debug('Additional questions collected', { totalQuestions: input.length });
        break;
      case stateMachine.states.COLLECTING_AVOID_TOPICS:
        data.avoid_topics = input;
        logger.debug('Topics to avoid collected', { topicCount: input.length });
        break;
      case stateMachine.states.COLLECTING_AI_STYLE:
        data.ai_style = input;
        logger.debug('AI style collected', { style: input });
        break;
      case stateMachine.states.COLLECTING_SCHEDULE:
        data.scheduled_time = input;
        logger.debug('Schedule collected', { scheduledTime: input });
        break;
    }
  }
  
  async completeConversation(user, phoneNumber, conversation) {
    try {
      logger.info('Completing conversation', { 
        conversationId: conversation.id,
        userId: user.id,
        storytellerName: conversation.data.storyteller.name,
        questionCount: conversation.data.questions.length 
      });
      // Create story request
      const storyRequest = await db.createStoryRequest(user.id, conversation.data);
      logger.info('Story request created', { 
        storyRequestId: storyRequest.id,
        conversationId: conversation.id,
        scheduledTime: conversation.data.scheduled_time 
      });
      
      // Clear conversation from Redis
      await redis.deleteConversationState(phoneNumber);
      logger.debug('Conversation cleared from Redis', { phoneNumber });
      
      // Schedule immediate processing if needed
      if (conversation.data.scheduled_time === 'now') {
        // Process immediately
        logger.info('Scheduling immediate call', { storyRequestId: storyRequest.id });
        setTimeout(() => {
          this.processStoryRequest(storyRequest);
        }, 1000);
        
        return "Great! I'm calling " + conversation.data.storyteller.name + 
               " right now. You'll receive the recording when it's ready. " +
               "This usually takes 10-30 minutes.";
      } else {
        return "Perfect! I'll call " + conversation.data.storyteller.name + 
               " at the scheduled time. You'll receive the recording when it's ready.";
      }
      
    } catch (error) {
      logger.error('Failed to complete conversation', { 
        error: error.message,
        stack: error.stack,
        conversationId: conversation.id 
      });
      return "Sorry, something went wrong setting up the call. Please try again later.";
    }
  }
  
  async cancelConversation(phoneNumber, conversationId) {
    logger.info('Cancelling conversation', { phoneNumber, conversationId });
    await redis.deleteConversationState(phoneNumber);
    if (conversationId) {
      await db.updateConversation(conversationId, stateMachine.states.CANCELLED, {});
      logger.debug('Conversation marked as cancelled in database', { conversationId });
    }
  }
  
  async processStoryRequest(storyRequest) {
    try {
      logger.info('Processing story request', { 
        storyRequestId: storyRequest.id,
        storytellerPhone: storyRequest.storyteller_phone 
      });
      // Update status to calling
      await db.updateStoryRequest(storyRequest.id, { 
        status: 'calling',
        called_at: new Date().toISOString()
      });
      logger.debug('Story request status updated to calling', { storyRequestId: storyRequest.id });
      
      // Create Vapi assistant and initiate call
      logger.info('Creating Vapi call', { storyRequestId: storyRequest.id });
      const result = await vapiService.createCallForStoryRequest(storyRequest);
      
      if (result.success) {
        await db.updateStoryRequest(storyRequest.id, {
          vapi_assistant_id: result.assistantId,
          vapi_call_id: result.callId,
          status: 'processing'
        });
        logger.info('Vapi call created successfully', { 
          storyRequestId: storyRequest.id,
          assistantId: result.assistantId,
          callId: result.callId 
        });
      } else {
        await db.updateStoryRequest(storyRequest.id, {
          status: 'failed'
        });
        logger.error('Vapi call creation failed', { 
          storyRequestId: storyRequest.id,
          error: result.error 
        });
        
        // Notify user of failure
        const user = await db.createOrGetUser(storyRequest.storyteller_phone);
        await twilioService.sendSMS(
          user.phone_number,
          `Sorry, I couldn't reach ${storyRequest.storyteller_name}. Please try again later.`
        );
      }
      
    } catch (error) {
      logger.error('Failed to process story request', { 
        error: error.message,
        stack: error.stack,
        storyRequestId: storyRequest.id 
      });
      await db.updateStoryRequest(storyRequest.id, {
        status: 'failed'
      });
    }
  }
}

module.exports = new SMSHandler();