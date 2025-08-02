const db = require('./database');
const redis = require('./redis');
const stateMachine = require('./conversation-states');
const twilioService = require('./twilio-client');
const vapiService = require('./vapi-client');

class SMSHandler {
  async handleIncomingSMS(phoneNumber, message) {
    try {
      // Log incoming message (works for both SMS and Telegram)
      await db.logSMS(phoneNumber, 'inbound', message);
      
      // Check rate limiting
      const rateLimit = await redis.checkRateLimit(phoneNumber);
      if (!rateLimit.allowed) {
        return "You've sent too many messages. Please try again later.";
      }
      
      // Get or create user (phoneNumber can be actual phone or telegram_chatId)
      const user = await db.createOrGetUser(phoneNumber);
      
      // Get conversation from Redis first (faster)
      let conversation = await redis.getConversationState(phoneNumber);
      
      // If not in Redis, check database
      if (!conversation) {
        const dbConversation = await db.getActiveConversation(user.id);
        if (dbConversation) {
          conversation = {
            id: dbConversation.id,
            state: dbConversation.state,
            data: dbConversation.current_data
          };
          // Store in Redis for faster access
          await redis.setConversationState(phoneNumber, conversation);
        }
      }
      
      // Handle based on current state
      if (!conversation) {
        // New conversation
        return await this.startNewConversation(user, phoneNumber, message);
      } else {
        // Continue existing conversation
        return await this.continueConversation(user, phoneNumber, conversation, message);
      }
      
    } catch (error) {
      console.error('SMS handler error:', error);
      return "Sorry, something went wrong. Please try again or text 'start' to begin a new conversation.";
    }
  }
  
  async startNewConversation(user, phoneNumber, message) {
    // Check for keywords
    const lowerMessage = message.toLowerCase().trim();
    
    if (lowerMessage === 'help') {
      return "Welcome to OldVoice! I help you record conversations with loved ones.\n\n" +
             "Text 'start' to begin setting up a call.\n" +
             "Text 'status' to check your recordings.\n" +
             "Text 'cancel' to stop current setup.";
    }
    
    if (lowerMessage === 'status') {
      return `You have ${user.total_recordings} recorded conversations. Text 'start' to record a new one!`;
    }
    
    if (lowerMessage === 'start' || lowerMessage === 'hello' || lowerMessage === 'hi') {
      // Create new conversation
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
      
      return stateMachine.getPrompt(stateMachine.states.INITIAL);
    }
    
    return "Hi! I'm OldVoice. I help you record conversations with your loved ones. Text 'start' to begin!";
  }
  
  async continueConversation(user, phoneNumber, conversation, message) {
    const currentState = conversation.state;
    const lowerMessage = message.toLowerCase().trim();
    
    // Check for cancel
    if (lowerMessage === 'cancel' || lowerMessage === 'stop') {
      await this.cancelConversation(phoneNumber, conversation.id);
      return "Conversation setup cancelled. Text 'start' to begin again.";
    }
    
    // Validate input
    if (!stateMachine.validateInput(currentState, message)) {
      const errorMessage = stateMachine.getError(currentState);
      return errorMessage;
    }
    
    // Transform and store input
    const transformedInput = stateMachine.transformInput(currentState, message, conversation.data);
    this.updateConversationData(conversation.data, currentState, transformedInput);
    
    // Get next state
    const nextState = stateMachine.getNextState(currentState, message);
    
    if (!nextState) {
      await this.cancelConversation(phoneNumber, conversation.id);
      return "Something went wrong. Please text 'start' to begin again.";
    }
    
    // Handle completion
    if (nextState === stateMachine.states.COMPLETED) {
      return await this.completeConversation(user, phoneNumber, conversation);
    }
    
    // Handle cancellation
    if (nextState === stateMachine.states.CANCELLED) {
      await this.cancelConversation(phoneNumber, conversation.id);
      return "Setup cancelled. Text 'start' to try again.";
    }
    
    // Update conversation state
    conversation.state = nextState;
    await redis.setConversationState(phoneNumber, conversation);
    await db.updateConversation(conversation.id, nextState, conversation.data);
    
    // Get next prompt
    const nextPrompt = stateMachine.getPrompt(nextState, conversation.data);
    return nextPrompt;
  }
  
  updateConversationData(data, state, input) {
    switch (state) {
      case stateMachine.states.COLLECTING_NAME:
        data.storyteller.name = input;
        break;
      case stateMachine.states.COLLECTING_PHONE:
        data.storyteller.phone = input;
        break;
      case stateMachine.states.COLLECTING_RELATIONSHIP:
        data.storyteller.relationship = input;
        break;
      case stateMachine.states.COLLECTING_PERSONALITY:
        data.storyteller.personality = input;
        break;
      case stateMachine.states.COLLECTING_BACKGROUND:
        data.storyteller.background = input;
        break;
      case stateMachine.states.COLLECTING_QUESTIONS:
        data.questions = input;
        break;
      case stateMachine.states.COLLECTING_MORE_QUESTIONS:
        data.questions = input;
        break;
      case stateMachine.states.COLLECTING_AVOID_TOPICS:
        data.avoid_topics = input;
        break;
      case stateMachine.states.COLLECTING_AI_STYLE:
        data.ai_style = input;
        break;
      case stateMachine.states.COLLECTING_SCHEDULE:
        data.scheduled_time = input;
        break;
    }
  }
  
  async completeConversation(user, phoneNumber, conversation) {
    try {
      // Create story request
      const storyRequest = await db.createStoryRequest(user.id, conversation.data);
      
      // Clear conversation from Redis
      await redis.deleteConversationState(phoneNumber);
      
      // Schedule immediate processing if needed
      if (conversation.data.scheduled_time === 'now') {
        // Process immediately
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
      console.error('Failed to complete conversation:', error);
      return "Sorry, something went wrong setting up the call. Please try again later.";
    }
  }
  
  async cancelConversation(phoneNumber, conversationId) {
    await redis.deleteConversationState(phoneNumber);
    if (conversationId) {
      await db.updateConversation(conversationId, stateMachine.states.CANCELLED, {});
    }
  }
  
  async processStoryRequest(storyRequest) {
    try {
      // Update status to calling
      await db.updateStoryRequest(storyRequest.id, { 
        status: 'calling',
        called_at: new Date().toISOString()
      });
      
      // Create Vapi assistant and initiate call
      const result = await vapiService.createCallForStoryRequest(storyRequest);
      
      if (result.success) {
        await db.updateStoryRequest(storyRequest.id, {
          vapi_assistant_id: result.assistantId,
          vapi_call_id: result.callId,
          status: 'processing'
        });
      } else {
        await db.updateStoryRequest(storyRequest.id, {
          status: 'failed'
        });
        
        // Notify user of failure
        const user = await db.createOrGetUser(storyRequest.storyteller_phone);
        await twilioService.sendSMS(
          user.phone_number,
          `Sorry, I couldn't reach ${storyRequest.storyteller_name}. Please try again later.`
        );
      }
      
    } catch (error) {
      console.error('Failed to process story request:', error);
      await db.updateStoryRequest(storyRequest.id, {
        status: 'failed'
      });
    }
  }
}

module.exports = new SMSHandler();