# Convert to Telegram Bot (10 minutes)

## 1. Create Telegram Bot
1. Open Telegram and message `@BotFather`
2. Send `/newbot`
3. Choose name: `OldVoice Bot`
4. Choose username: `oldvoice_bot`
5. Copy the bot token

## 2. Update Code
Replace Twilio webhook with Telegram webhook:

```javascript
// api/telegram-webhook.js
const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

router.post('/api/telegram/webhook', async (req, res) => {
  const { message } = req.body;
  const chatId = message.chat.id;
  const text = message.text;
  
  // Use same conversation handler
  const response = await smsHandler.handleIncomingSMS(chatId, text);
  
  bot.sendMessage(chatId, response);
  res.sendStatus(200);
});
```

## 3. Benefits Over SMS
- Instant setup (no waiting!)
- Free (no per-message costs)
- Better UX (buttons, formatting)
- Voice message support
- File sharing for recordings

## 4. User Flow
Instead of "Text START to 555-1234", it's:
"Message @oldvoice_bot on Telegram"

Everything else stays exactly the same!