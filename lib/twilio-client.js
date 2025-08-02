const twilio = require('twilio');
const config = require('../config');

const client = twilio(config.twilio.accountSid, config.twilio.authToken);

const twilioService = {
  async sendSMS(to, body) {
    try {
      const message = await client.messages.create({
        body,
        from: config.twilio.phoneNumber,
        to
      });
      
      return {
        success: true,
        messageId: message.sid
      };
    } catch (error) {
      console.error('Failed to send SMS:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },
  
  validateWebhook(req) {
    const signature = req.headers['x-twilio-signature'];
    const url = `${config.app.url}${req.originalUrl}`;
    
    return twilio.validateRequest(
      config.twilio.authToken,
      signature,
      url,
      req.body
    );
  },
  
  formatResponse(message) {
    const response = new twilio.twiml.MessagingResponse();
    response.message(message);
    return response.toString();
  }
};

module.exports = twilioService;