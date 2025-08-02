# OldVoice SMS Setup Guide

This guide will walk you through setting up OldVoice SMS to receive SMS messages and schedule AI phone calls.

## Prerequisites
- Node.js installed
- Redis installed (we've already done this)
- Twilio account
- Vapi account
- Supabase account (already configured)
- ngrok (for local development)

## Step 1: Configure Your Twilio Account

1. **Log in to Twilio Console**: https://console.twilio.com

2. **Get a Phone Number** (if you don't have one):
   - Navigate to Phone Numbers → Manage → Buy a number
   - Choose a number with SMS capabilities
   - Purchase the number

3. **Configure SMS Webhook**:
   - Go to Phone Numbers → Manage → Active Numbers
   - Click on your phone number
   - In the "Messaging Configuration" section:
     - Set "A message comes in" webhook to: `https://your-domain.com/api/twilio/sms`
     - Method: `HTTP POST`
     - Save the configuration

4. **Note Your Credentials** (already in .env):
   - Account SID
   - Auth Token
   - Phone Number

## Step 2: Configure Your Vapi Account

1. **Log in to Vapi**: https://dashboard.vapi.ai

2. **Set Up Phone Number**:
   - Navigate to Phone Numbers
   - Add or configure your phone number
   - Note the Phone Number ID (already in .env as `VAPI_PHONE_NUMBER_ID`)

3. **Configure Webhook**:
   - Go to Settings → Webhooks
   - Add webhook URL: `https://your-domain.com/api/vapi/webhook`
   - Enable all event types
   - Save the configuration

4. **Get API Key** (already in .env):
   - Go to Settings → API Keys
   - Your key is already configured

## Step 3: Local Development Setup

### Using ngrok (Recommended for Testing)

1. **Install ngrok** (if not installed):
   ```bash
   brew install ngrok
   ```

2. **Start ngrok**:
   ```bash
   ngrok http 3000
   ```

3. **Copy the HTTPS URL** (looks like: `https://abc123.ngrok.io`)

4. **Update Webhooks**:
   - **Twilio**: Update webhook to `https://abc123.ngrok.io/api/twilio/sms`
   - **Vapi**: Update webhook to `https://abc123.ngrok.io/api/vapi/webhook`

## Step 4: Testing the Application

### Option 1: Test with Real SMS
1. Send "start" to your Twilio phone number from your phone (4025705917)
2. Follow the conversation prompts

### Option 2: Test Locally
```bash
node scripts/test-sms.js
```

## Step 5: Production Deployment

1. **Deploy to a Cloud Provider** (Heroku, AWS, Google Cloud, etc.)

2. **Update Environment Variables** on your server:
   ```
   PORT=3000
   NODE_ENV=production
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=your_twilio_number
   VAPI_API_KEY=your_vapi_key
   VAPI_PHONE_NUMBER_ID=your_vapi_phone_id
   SUPABASE_URL=https://hbyhdwzujkcyjxsxfiym.supabase.co
   SUPABASE_ANON_KEY=your_supabase_key
   REDIS_URL=your_redis_url
   APP_URL=https://your-production-domain.com
   ```

3. **Update Webhooks** to production URLs:
   - Twilio: `https://your-domain.com/api/twilio/sms`
   - Vapi: `https://your-domain.com/api/vapi/webhook`

## How the SMS Flow Works

1. **User texts "start"** to your Twilio number
2. **Bot guides through setup**:
   - Storyteller's name
   - Phone number (e.g., 4025705917)
   - Relationship
   - Personality description
   - Background info
   - Questions to ask
   - Topics to avoid
   - AI interviewer style
   - Call scheduling
3. **Confirmation** and call initiation
4. **Recording delivered** after call completes

## Troubleshooting

### Redis Connection Issues
```bash
brew services restart redis
```

### Check Server Logs
```bash
tail -f logs/app.log
```

### Test Health Endpoint
```bash
curl http://localhost:3000/health
```

### Database Issues
- Verify Supabase credentials in .env
- Check if tables exist in Supabase dashboard
- Run schema.sql if needed

## Security Notes

- Never commit .env file
- Keep API keys secure
- Use HTTPS in production
- Enable Supabase Row Level Security for production

## Support

For issues, check:
- Server logs in `/logs` directory
- Twilio debugger: https://console.twilio.com/debugger
- Vapi dashboard for call logs