const express = require('express');
const router = express.Router();
const TelegramBot = require('node-telegram-bot-api');
const smsHandler = require('../lib/sms-handler');
const logger = require('../lib/logger');

// Initialize bot (webhook mode)
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

// Webhook endpoint for Telegram
router.post('/webhook', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || !message.text) {
      return res.sendStatus(200);
    }

    const chatId = message.chat.id;
    const text = message.text;
    const fromUser = message.from;

    logger.info('Received Telegram message', {
      chatId,
      text: text.substring(0, 100),
      username: fromUser.username
    });

    // Use chat ID as unique identifier (like phone number)
    const uniqueId = `telegram_${chatId}`;
    
    // Handle the message using existing SMS handler
    const response = await smsHandler.handleIncomingSMS(uniqueId, text);

    // Send response back to user
    const keyboard = getKeyboardForState(response);
    const messageOptions = {
      parse_mode: 'Markdown'
    };
    
    if (keyboard) {
      messageOptions.reply_markup = {
        resize_keyboard: true,
        keyboard: keyboard
      };
    }
    
    await bot.sendMessage(chatId, response, messageOptions);

    res.sendStatus(200);
  } catch (error) {
    logger.error('Telegram webhook error', error);
    res.sendStatus(200); // Always return 200 to prevent Telegram retries
  }
});

// Helper function to provide quick reply buttons based on conversation state
function getKeyboardForState(response) {
  // Provide contextual buttons based on the response
  if (response.includes('Choose one:')) {
    return [
      ['1', '2', '3']
    ];
  }
  if (response.includes("Reply 'done'")) {
    return [
      ['done']
    ];
  }
  if (response.includes("Reply 'yes'") || response.includes("'cancel'")) {
    return [
      ['yes', 'cancel']
    ];
  }
  if (response.includes("Reply 'none'")) {
    return [
      ['none']
    ];
  }
  
  // Default - no keyboard
  return null;
}

// Set webhook endpoint
router.post('/set-webhook', async (req, res) => {
  try {
    const webhookUrl = `${process.env.APP_URL}/api/telegram/webhook`;
    await bot.setWebHook(webhookUrl);
    
    logger.info('Telegram webhook set', { webhookUrl });
    res.json({ success: true, webhookUrl });
  } catch (error) {
    logger.error('Failed to set Telegram webhook', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;