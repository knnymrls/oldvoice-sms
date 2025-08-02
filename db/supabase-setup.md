# Supabase Setup Instructions

## 1. Create a Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Click "New project"
3. Fill in:
   - Project name: `oldvoice-sms`
   - Database password: (save this securely)
   - Region: Choose closest to your users
   - Pricing plan: Start with Free tier

## 2. Run Database Schema

1. Once project is created, go to SQL Editor
2. Click "New query"
3. Copy contents of `schema.sql` and paste
4. Click "Run" to execute

## 3. Get API Credentials

1. Go to Settings → API
2. Copy these values to your `.env`:
   - `SUPABASE_URL`: Your project URL
   - `SUPABASE_ANON_KEY`: Your anon/public key

## 4. Enable Row Level Security (Optional)

For production, enable RLS on tables:

```sql
-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

-- Create policies as needed
-- Example: Users can only see their own data
CREATE POLICY "Users can view own data" ON story_requests
  FOR SELECT USING (user_id = auth.uid());
```

## 5. Set up Database Functions (Optional)

Create a scheduled job to clean up expired conversations:

```sql
-- Run every hour
SELECT cron.schedule(
  'cleanup-conversations',
  '0 * * * *',
  'SELECT cleanup_expired_conversations();'
);
```

## 6. Monitor Usage

- Check Table Editor to view data
- Use Logs to debug issues
- Monitor API usage in Usage tab