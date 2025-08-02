# Deploy to Railway in 5 Minutes 🚂

## Step 1: Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub

## Step 2: Deploy Your App

### Option A: Deploy via GitHub (Recommended)
1. Push your code to GitHub first
2. Click "New Project" in Railway
3. Select "Deploy from GitHub repo"
4. Choose your repository
5. Railway auto-deploys!

### Option B: Deploy via CLI
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Deploy
railway up
```

## Step 3: Add Redis
1. In your Railway project, click "+ New"
2. Select "Database" → "Add Redis"
3. It's automatically connected!

## Step 4: Set Environment Variables
1. Click on your app service
2. Go to "Variables" tab
3. Add all your .env variables:
   - `PORT` = 3000
   - `TWILIO_ACCOUNT_SID` = (your value)
   - `TWILIO_AUTH_TOKEN` = (your value)
   - `TWILIO_PHONE_NUMBER` = +5319996461
   - `VAPI_API_KEY` = (your value)
   - `VAPI_PHONE_NUMBER_ID` = (your value)
   - `SUPABASE_URL` = https://hbyhdwzujkcyjxsxfiym.supabase.co
   - `SUPABASE_ANON_KEY` = (your value)
   - `APP_URL` = (will be provided by Railway)

## Step 5: Get Your Public URL
1. Go to Settings → Domains
2. Click "Generate Domain"
3. You'll get something like: `oldvoice-sms-production.up.railway.app`

## Step 6: Update Webhooks
1. **Twilio**: Set webhook to `https://your-app.up.railway.app/api/twilio/sms`
2. **Vapi**: Set webhook to `https://your-app.up.railway.app/api/vapi/webhook`

## That's it! 🎉

Your app is now live and can receive real SMS messages!

### Costs
- First $5 free every month
- After that: ~$5-10/month for this app
- Includes hosting + Redis

### Alternative: Render.com
If you prefer Render:
1. Go to [render.com](https://render.com)
2. New → Web Service
3. Connect GitHub repo
4. Use these settings:
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Add environment variables
6. Deploy!