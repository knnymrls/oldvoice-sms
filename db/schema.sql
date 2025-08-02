-- OldVoice SMS Database Schema
-- This file contains the PostgreSQL schema for the OldVoice SMS application
-- Run this in your Supabase SQL editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (created from first SMS)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  total_recordings INTEGER DEFAULT 0
);

-- Create index on phone number for faster lookups
CREATE INDEX idx_users_phone_number ON users(phone_number);

-- Conversations table (SMS state tracking)
CREATE TABLE conversations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  state VARCHAR(50) DEFAULT 'initial',
  current_data JSONB DEFAULT '{}',
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '1 hour',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for active conversations
CREATE INDEX idx_conversations_user_expires ON conversations(user_id, expires_at);

-- Story requests table
CREATE TABLE story_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  
  -- Quick access fields
  storyteller_name VARCHAR(100),
  storyteller_phone VARCHAR(20),
  
  -- All form data as JSON
  form_data JSONB NOT NULL,
  /* Structure:
  {
    "storyteller": {
      "name": "Grandma Rose",
      "phone": "+1234567890",
      "relationship": "grandmother",
      "personality": "Formal but warms up when talking about cooking",
      "background": "Polish immigrant"
    },
    "questions": [
      "Her secret pierogi recipe",
      "Why she left Poland",
      "Her first years in America"
    ],
    "avoid_topics": ["her sister who passed"],
    "ai_style": "warm",
    "scheduled_time": "now"
  }
  */
  
  -- Vapi fields
  vapi_assistant_id VARCHAR(100),
  vapi_call_id VARCHAR(100),
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'calling', 'processing', 'completed', 'failed')),
  recording_url TEXT,
  transcript TEXT,
  duration_seconds INTEGER,
  
  -- Timestamps
  scheduled_for TIMESTAMP,
  called_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for story requests
CREATE INDEX idx_story_requests_user_id ON story_requests(user_id);
CREATE INDEX idx_story_requests_status ON story_requests(status);
CREATE INDEX idx_story_requests_scheduled ON story_requests(scheduled_for) WHERE status = 'scheduled';

-- SMS logs for debugging
CREATE TABLE sms_logs (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(20),
  direction VARCHAR(10) CHECK (direction IN ('inbound', 'outbound')),
  message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for SMS logs
CREATE INDEX idx_sms_logs_phone_created ON sms_logs(phone_number, created_at DESC);

-- Function to clean up expired conversations
CREATE OR REPLACE FUNCTION cleanup_expired_conversations()
RETURNS void AS $$
BEGIN
  DELETE FROM conversations WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to increment user recordings count
CREATE OR REPLACE FUNCTION increment_user_recordings(user_id_param INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE users 
  SET total_recordings = total_recordings + 1 
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions for Supabase
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres;