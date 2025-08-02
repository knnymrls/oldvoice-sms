# OldVoice SMS

An SMS-based application that helps users set up AI phone calls to record stories from elderly relatives.

## Features

- SMS conversation interface for setting up calls
- Integration with Vapi for AI-powered phone conversations
- Automatic call scheduling and recording
- Story transcription and delivery
- Redis-based session management
- Supabase for data persistence

## Prerequisites

- Node.js 16+
- Redis server
- Supabase account
- Twilio account
- Vapi account

## Setup Instructions

### 1. Clone and Install

```bash
npm install
```

### 2. Set up Supabase

1. Create a new Supabase project at https://app.supabase.com
2. Run the schema from `db/schema.sql` in your Supabase SQL editor
3. Copy your project URL and anon key

### 3. Set up Twilio

1. Create a Twilio account
2. Get a phone number with SMS capabilities
3. Set webhook URL to: `https://your-domain.com/api/twilio/sms`

### 4. Set up Vapi

1. Create a Vapi account at https://vapi.ai
2. Get your API key
3. Set up a phone number in Vapi

### 5. Configure Environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

### 6. Start Redis

```bash
redis-server
```

### 7. Run the Application

Development:
```bash
npm run dev
```

Production:
```bash
npm start
```

## SMS Flow

1. User texts "start" to begin
2. Bot guides through collecting:
   - Storyteller's name and phone
   - Relationship and personality
   - Background information
   - Questions to ask
   - Topics to avoid
   - AI interviewer style
   - Call scheduling
3. Vapi makes the call
4. Recording and transcript sent back via SMS

## API Endpoints

- `POST /api/twilio/sms` - Twilio webhook for incoming SMS
- `POST /api/vapi/webhook` - Vapi webhook for call events
- `GET /health` - Health check endpoint

## Architecture

- **Express** - Web framework
- **Twilio** - SMS messaging
- **Vapi** - AI phone calls
- **Supabase** - PostgreSQL database
- **Redis** - Session storage
- **Winston** - Logging

## Testing

Send an SMS to your Twilio number with "start" to begin the flow.

## Deployment

1. Set up environment variables on your hosting platform
2. Ensure Redis is available
3. Configure Twilio webhook URLs
4. Set up SSL for production use

## Monitoring

- Logs are written to console and files (in production)
- Database includes SMS logs for debugging
- Vapi webhook events are logged

## License

ISC