const states = {
  INITIAL: 'initial',
  COLLECTING_NAME: 'collecting_name',
  COLLECTING_PHONE: 'collecting_phone',
  COLLECTING_RELATIONSHIP: 'collecting_relationship',
  COLLECTING_PERSONALITY: 'collecting_personality',
  COLLECTING_BACKGROUND: 'collecting_background',
  COLLECTING_QUESTIONS: 'collecting_questions',
  COLLECTING_MORE_QUESTIONS: 'collecting_more_questions',
  COLLECTING_AVOID_TOPICS: 'collecting_avoid_topics',
  COLLECTING_AI_STYLE: 'collecting_ai_style',
  COLLECTING_SCHEDULE: 'collecting_schedule',
  CONFIRMING: 'confirming',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

const transitions = {
  [states.INITIAL]: {
    next: states.COLLECTING_NAME,
    prompt: "Hi! I'm here to help you record a special conversation with your loved one. Let's start by setting up the details.\n\nWhat's the name of the person you'd like to have a conversation with?"
  },
  
  [states.COLLECTING_NAME]: {
    next: states.COLLECTING_PHONE,
    validate: (input) => input.trim().length > 0,
    error: "Please provide the person's name.",
    prompt: (data) => `Great! What's the best phone number to reach ${data.storyteller.name}?`
  },
  
  [states.COLLECTING_PHONE]: {
    next: states.COLLECTING_RELATIONSHIP,
    validate: (input) => {
      const cleaned = input.replace(/\D/g, '');
      return cleaned.length >= 10;
    },
    transform: (input) => {
      const cleaned = input.replace(/\D/g, '');
      if (cleaned.length === 10) {
        return `+1${cleaned}`;
      } else if (cleaned.length === 11 && cleaned[0] === '1') {
        return `+${cleaned}`;
      }
      return `+${cleaned}`;
    },
    error: "Please provide a valid phone number.",
    prompt: (data) => `What's your relationship to ${data.storyteller.name}? (e.g., grandmother, father, uncle)`
  },
  
  [states.COLLECTING_RELATIONSHIP]: {
    next: states.COLLECTING_PERSONALITY,
    validate: (input) => input.trim().length > 0,
    prompt: (data) => `How would you describe ${data.storyteller.name}'s personality? This helps the AI adapt its conversation style. (e.g., "formal but warms up when talking about gardening")`
  },
  
  [states.COLLECTING_PERSONALITY]: {
    next: states.COLLECTING_BACKGROUND,
    validate: (input) => input.trim().length > 0,
    prompt: (data) => `What's some background about ${data.storyteller.name} that might be helpful? (e.g., "Polish immigrant who came to America in 1960s")`
  },
  
  [states.COLLECTING_BACKGROUND]: {
    next: states.COLLECTING_QUESTIONS,
    validate: (input) => input.trim().length > 0,
    prompt: "What would you like to ask about? Share 1-3 specific topics or questions."
  },
  
  [states.COLLECTING_QUESTIONS]: {
    next: states.COLLECTING_MORE_QUESTIONS,
    validate: (input) => input.trim().length > 0,
    transform: (input) => [input.trim()],
    prompt: "Any other questions? (Reply 'done' if you're finished)"
  },
  
  [states.COLLECTING_MORE_QUESTIONS]: {
    next: (input) => input.toLowerCase() === 'done' ? states.COLLECTING_AVOID_TOPICS : states.COLLECTING_MORE_QUESTIONS,
    validate: (input) => input.trim().length > 0,
    transform: (input, data) => {
      if (input.toLowerCase() === 'done') return data.questions;
      return [...data.questions, input.trim()];
    },
    prompt: (data) => {
      if (data.questions.length >= 5) {
        return "Great questions! Are there any sensitive topics to avoid? (Reply 'none' if not)";
      }
      return "Any other questions? (Reply 'done' if you're finished)";
    }
  },
  
  [states.COLLECTING_AVOID_TOPICS]: {
    next: states.COLLECTING_AI_STYLE,
    validate: (input) => input.trim().length > 0,
    transform: (input) => input.toLowerCase() === 'none' ? [] : [input.trim()],
    prompt: "How should the AI interviewer be? Choose one:\n1) Warm & friendly\n2) Professional journalist\n3) Curious grandchild"
  },
  
  [states.COLLECTING_AI_STYLE]: {
    next: states.COLLECTING_SCHEDULE,
    validate: (input) => ['1', '2', '3', 'warm', 'professional', 'curious'].includes(input.toLowerCase()),
    transform: (input) => {
      const styles = {
        '1': 'warm',
        '2': 'professional',
        '3': 'curious',
        'warm': 'warm',
        'professional': 'professional',
        'curious': 'curious'
      };
      return styles[input.toLowerCase()];
    },
    error: "Please choose 1, 2, or 3",
    prompt: "When should I make the call?\n1) Now\n2) In 30 minutes\n3) In 1 hour\n4) Custom time"
  },
  
  [states.COLLECTING_SCHEDULE]: {
    next: states.CONFIRMING,
    validate: (input) => {
      if (['1', '2', '3', '4', 'now', '30', '60', 'custom'].includes(input.toLowerCase())) {
        return true;
      }
      // Check if it's a time format
      return /^\d{1,2}:\d{2}\s?(am|pm)?$/i.test(input);
    },
    transform: (input) => {
      const schedules = {
        '1': 'now',
        '2': new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        '3': new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        'now': 'now',
        '30': new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        '60': new Date(Date.now() + 60 * 60 * 1000).toISOString()
      };
      
      if (schedules[input.toLowerCase()]) {
        return schedules[input.toLowerCase()];
      }
      
      // Handle custom time
      return input;
    },
    prompt: (data) => {
      const time = data.scheduled_time === 'now' ? 'immediately' : `at ${new Date(data.scheduled_time).toLocaleTimeString()}`;
      return `Perfect! Here's what I have:\n\n` +
        `📞 Calling: ${data.storyteller.name} (${data.storyteller.phone})\n` +
        `👤 Relationship: ${data.storyteller.relationship}\n` +
        `🎯 Questions: ${data.questions.length} topics\n` +
        `🤖 Style: ${data.ai_style} interviewer\n` +
        `⏰ When: ${time}\n\n` +
        `Reply 'yes' to confirm or 'cancel' to start over.`;
    }
  },
  
  [states.CONFIRMING]: {
    next: (input) => input.toLowerCase() === 'yes' ? states.COMPLETED : states.CANCELLED,
    validate: (input) => ['yes', 'no', 'cancel'].includes(input.toLowerCase()),
    error: "Please reply 'yes' to confirm or 'cancel' to start over."
  }
};

const stateMachine = {
  states,
  transitions,
  
  getNextState(currentState, input) {
    const transition = transitions[currentState];
    if (!transition) return null;
    
    if (typeof transition.next === 'function') {
      return transition.next(input);
    }
    
    return transition.next;
  },
  
  validateInput(state, input) {
    const transition = transitions[state];
    if (!transition || !transition.validate) return true;
    return transition.validate(input);
  },
  
  transformInput(state, input, currentData) {
    const transition = transitions[state];
    if (!transition || !transition.transform) return input;
    return transition.transform(input, currentData);
  },
  
  getPrompt(state, data) {
    const transition = transitions[state];
    if (!transition) return null;
    
    if (typeof transition.prompt === 'function') {
      return transition.prompt(data);
    }
    
    return transition.prompt;
  },
  
  getError(state) {
    const transition = transitions[state];
    return transition?.error || "Invalid input. Please try again.";
  }
};

module.exports = stateMachine;