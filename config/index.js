require('dotenv').config();

const config = {
  server: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development'
  },
  
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER
  },
  
  vapi: {
    apiKey: process.env.VAPI_API_KEY,
    phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID
  },
  
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  },
  
  app: {
    url: process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`
  }
};

// Validate required configurations
const requiredConfigs = [
  ['twilio.accountSid', config.twilio.accountSid],
  ['twilio.authToken', config.twilio.authToken],
  ['twilio.phoneNumber', config.twilio.phoneNumber],
  ['vapi.apiKey', config.vapi.apiKey],
  ['supabase.url', config.supabase.url],
  ['supabase.anonKey', config.supabase.anonKey]
];

const missingConfigs = requiredConfigs
  .filter(([name, value]) => !value)
  .map(([name]) => name);

if (missingConfigs.length > 0) {
  console.error('Missing required configuration:', missingConfigs.join(', '));
  console.error('Please check your .env file');
  process.exit(1);
}

module.exports = config;