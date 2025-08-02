const express = require('express');
const router = express.Router();
const smsHandler = require('../lib/sms-handler');
const twilioService = require('../lib/twilio-client');
const db = require('../lib/database');

// Twilio webhook for incoming SMS
router.post('/sms', async (req, res) => {
  try {
    // Validate webhook signature in production
    if (process.env.NODE_ENV === 'production') {
      const isValid = twilioService.validateWebhook(req);
      if (!isValid) {
        return res.status(403).send('Forbidden');
      }
    }
    
    const { From: phoneNumber, Body: message } = req.body;
    
    // Handle the SMS
    const response = await smsHandler.handleIncomingSMS(phoneNumber, message);
    
    // Log outbound response
    await db.logSMS(phoneNumber, 'outbound', response);
    
    // Send response
    res.type('text/xml');
    res.send(twilioService.formatResponse(response));
    
  } catch (error) {
    console.error('Twilio webhook error:', error);
    
    // Send error response
    res.type('text/xml');
    res.send(twilioService.formatResponse(
      'Sorry, something went wrong. Please try again later.'
    ));
  }
});

// Status callback for message delivery
router.post('/sms/status', async (req, res) => {
  try {
    const { MessageSid, MessageStatus, ErrorCode } = req.body;
    
    console.log('SMS Status Update:', {
      sid: MessageSid,
      status: MessageStatus,
      error: ErrorCode
    });
    
    res.sendStatus(200);
  } catch (error) {
    console.error('Status callback error:', error);
    res.sendStatus(500);
  }
});

module.exports = router;