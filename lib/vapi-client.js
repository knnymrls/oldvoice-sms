const fetch = require('node-fetch');
const config = require('../config');

const VAPI_BASE_URL = 'https://api.vapi.ai';

class VapiClient {
  constructor() {
    this.apiKey = config.vapi.apiKey;
    this.phoneNumberId = config.vapi.phoneNumberId;
  }
  
  async makeRequest(endpoint, method = 'GET', body = null) {
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${VAPI_BASE_URL}${endpoint}`, options);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Vapi API error');
    }
    
    return data;
  }
  
  buildAssistantPrompt(storyRequest) {
    const { storyteller, questions, avoid_topics, ai_style } = storyRequest.form_data;
    
    const stylePrompts = {
      warm: "You are a warm, friendly interviewer having a heartfelt conversation.",
      professional: "You are a professional oral historian conducting an interview.",
      curious: "You are like a curious grandchild, eager to learn family stories."
    };
    
    const avoidSection = avoid_topics.length > 0 
      ? `\n\nTopics to avoid: ${avoid_topics.join(', ')}` 
      : '';
    
    return `${stylePrompts[ai_style]}
    
You're speaking with ${storyteller.name}, who is the caller's ${storyteller.relationship}.

Background: ${storyteller.background}
Personality: ${storyteller.personality}

Your goal is to have a natural conversation exploring these topics:
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Guidelines:
- Be conversational and build rapport
- Ask follow-up questions to get deeper stories
- Show genuine interest and empathy
- Keep the conversation flowing naturally
- Aim for 10-20 minutes of conversation
- Thank them at the end${avoidSection}

Start by introducing yourself warmly and explaining you're calling on behalf of their ${storyteller.relationship === 'grandmother' || storyteller.relationship === 'mother' ? 'grandchild/child' : 'family member'}.`;
  }
  
  async createAssistant(storyRequest) {
    const assistant = {
      name: `Story Collector - ${storyRequest.storyteller_name}`,
      model: {
        provider: "openai",
        model: "gpt-4",
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: this.buildAssistantPrompt(storyRequest)
          }
        ]
      },
      voice: {
        provider: "11labs",
        voiceId: "21m00Tcm4TlvDq8ikWAM" // Rachel voice - warm and friendly
      },
      firstMessage: `Hello! Is this ${storyRequest.form_data.storyteller.name}? I'm calling on behalf of your family member who wanted to record some of your stories. They thought it would be wonderful to preserve your memories. Do you have a few minutes to chat?`,
      recordingEnabled: true,
      endCallPhrases: ["goodbye", "bye", "talk to you later", "have a good day"],
      maxDurationSeconds: 1800, // 30 minutes max
      transcriber: {
        provider: "deepgram",
        model: "nova-2"
      },
      serverUrl: `${config.app.url}/api/vapi/webhook`,
      serverUrlSecret: config.vapi.apiKey
    };
    
    return await this.makeRequest('/assistant', 'POST', assistant);
  }
  
  async createPhoneCall(assistantId, toNumber) {
    const callRequest = {
      assistantId,
      phoneNumberId: this.phoneNumberId,
      customer: {
        number: toNumber
      }
    };
    
    return await this.makeRequest('/call/phone', 'POST', callRequest);
  }
  
  async createCallForStoryRequest(storyRequest) {
    try {
      // Create assistant
      const assistant = await this.createAssistant(storyRequest);
      
      // Initiate call
      const call = await this.createPhoneCall(
        assistant.id,
        storyRequest.storyteller_phone
      );
      
      return {
        success: true,
        assistantId: assistant.id,
        callId: call.id
      };
      
    } catch (error) {
      console.error('Failed to create Vapi call:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  async getCall(callId) {
    return await this.makeRequest(`/call/${callId}`);
  }
  
  async getRecording(callId) {
    const call = await this.getCall(callId);
    return {
      recordingUrl: call.recordingUrl,
      transcript: call.transcript,
      duration: call.duration
    };
  }
}

module.exports = new VapiClient();