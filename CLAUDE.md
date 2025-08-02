# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OldVoice SMS is a Node.js/Express application that facilitates AI-powered phone calls to record stories from elderly relatives. Users interact via SMS to set up calls, and the system uses Vapi for AI phone conversations.

## Common Commands

### Development
```bash
# Install dependencies
npm install

# Start development server with auto-reload
npm run dev

# Start production server
npm start

# Test SMS conversation flow locally
node scripts/test-sms.js
```

### Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Start Redis (required for conversation state)
redis-server
```

## Architecture

### Core Dependencies
- **Express 5.1.0**: Web framework
- **Twilio SDK**: SMS messaging
- **Vapi API**: AI phone calls
- **Supabase**: PostgreSQL database
- **Redis**: Conversation state management
- **Winston**: Logging

### Key Components

1. **SMS Conversation Handler** (`lib/sms-handler.js`): 
   - Manages multi-step SMS conversations using state machine pattern
   - States defined in `lib/conversation-states.js`
   - Redis stores conversation state with 24-hour expiration

2. **API Endpoints**:
   - `/api/twilio/sms`: Receives incoming SMS messages
   - `/api/vapi/webhook`: Handles Vapi call events
   - `/health`: Health check

3. **Database Schema** (`db/schema.sql`):
   - `users`: SMS users by phone number
   - `conversations`: Active conversation states
   - `story_requests`: Main data for recording requests
   - `sms_logs`: Audit trail

### Conversation Flow
The SMS conversation follows a state machine through these steps:
1. WELCOME → Gather storyteller name
2. STORYTELLER_NAME → Get phone number
3. STORYTELLER_PHONE → Get relationship
4. RELATIONSHIP → Get personality
5. PERSONALITY → Get background
6. BACKGROUND → Collect questions
7. QUESTIONS → Topics to avoid
8. TOPICS_TO_AVOID → Choose AI style
9. AI_STYLE → Schedule call
10. SCHEDULING → Confirm and complete

## Development Notes

- No formal testing framework - use `scripts/test-sms.js` for manual testing
- No linting configuration - follow existing code style
- Logs written to console and `logs/` directory
- Environment variables required - see `.env.example`
- Twilio webhook must be publicly accessible - use ngrok for local development

## External Service Configuration

### Twilio
- Webhook URL: `https://your-domain.com/api/twilio/sms`
- Method: POST

### Vapi
- Webhook URL: `https://your-domain.com/api/vapi/webhook`
- Events: All call events

### Supabase
- Run schema from `db/schema.sql`
- See `db/supabase-setup.md` for detailed setup