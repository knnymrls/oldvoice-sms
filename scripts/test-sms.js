#!/usr/bin/env node

/**
 * Test script to simulate SMS conversations locally
 * Usage: node scripts/test-sms.js
 */

require('dotenv').config();
const smsHandler = require('../lib/sms-handler');

const testPhoneNumber = '+14025705917';

async function simulateConversation() {
  console.log('Starting SMS conversation simulation...\n');
  
  const messages = [
    'start',
    'Grandma Rose',
    '+14025705917',  // Fixed phone format
    'grandmother',
    'Very formal at first but warms up when talking about cooking',
    'Polish immigrant who came to America in 1965',
    'Her secret pierogi recipe',
    'Why she left Poland',
    'done',
    'none',
    '1',
    '1',
    'yes'
  ];
  
  for (const message of messages) {
    console.log(`User: ${message}`);
    const response = await smsHandler.handleIncomingSMS(testPhoneNumber, message);
    console.log(`Bot: ${response}\n`);
    console.log('---\n');
    
    // Add delay to simulate real conversation
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('Conversation simulation complete!');
  process.exit(0);
}

// Run simulation
simulateConversation().catch(error => {
  console.error('Simulation error:', error);
  process.exit(1);
});