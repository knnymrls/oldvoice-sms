#!/usr/bin/env node

/**
 * Test script for Telegram bot locally
 * Usage: node scripts/test-telegram.js
 */

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const smsHandler = require('../lib/sms-handler');

// Create bot in polling mode for testing
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

console.log('🤖 Telegram bot started in test mode!');
console.log('Send a message to your bot to test the conversation flow.');
console.log('Bot username: @oldvoice_bot');
console.log('Press Ctrl+C to stop.\n');

// Handle incoming messages
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const username = msg.from.username || msg.from.first_name;
  
  console.log(`📥 Received from @${username}: ${text}`);
  
  try {
    // Use telegram_chatId as unique identifier
    const uniqueId = `telegram_${chatId}`;
    
    // Process message through SMS handler
    const response = await smsHandler.handleIncomingSMS(uniqueId, text);
    
    console.log(`📤 Bot response: ${response.substring(0, 100)}...`);
    
    // Send response with contextual keyboard
    await bot.sendMessage(chatId, response, {
      parse_mode: 'Markdown',
      reply_markup: {
        resize_keyboard: true,
        keyboard: getKeyboardForState(response)
      }
    });
  } catch (error) {
    console.error('❌ Error:', error);
    bot.sendMessage(chatId, 'Sorry, something went wrong. Please try again.');
  }
});

// Helper function for quick reply buttons
function getKeyboardForState(response) {
  if (response.includes('Choose one:')) {
    return [['1', '2', '3']];
  }
  if (response.includes("Reply 'done'")) {
    return [['done']];
  }
  if (response.includes("Reply 'yes'") || response.includes("'cancel'")) {
    return [['yes', 'cancel']];
  }
  if (response.includes("Reply 'none'")) {
    return [['none']];
  }
  
  return { remove_keyboard: true };
}

// Handle errors
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});