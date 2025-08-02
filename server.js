const express = require('express');
const config = require('./config');
const logger = require('./lib/logger');
const { errorHandler, notFound } = require('./lib/error-handler');
const db = require('./lib/database');
const redis = require('./lib/redis');
const smsHandler = require('./lib/sms-handler');

// Import routes
const twilioWebhook = require('./api/twilio-webhook');
const vapiWebhook = require('./api/vapi-webhook');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info({
    method: req.method,
    url: req.url,
    ip: req.ip
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/twilio', twilioWebhook);
app.use('/api/vapi', vapiWebhook);

// Admin endpoint to process pending calls
app.post('/api/admin/process-pending', async (req, res) => {
  try {
    const pendingRequests = await db.getPendingStoryRequests();
    
    for (const request of pendingRequests) {
      setTimeout(() => {
        smsHandler.processStoryRequest(request);
      }, 1000);
    }
    
    res.json({
      success: true,
      processed: pendingRequests.length
    });
  } catch (error) {
    logger.error('Failed to process pending requests:', error);
    res.status(500).json({ error: 'Failed to process requests' });
  }
});

// Error handling
app.use(notFound);
app.use(errorHandler);

// Cleanup job - run every hour
setInterval(async () => {
  try {
    await db.cleanupExpiredConversations();
    logger.info('Cleaned up expired conversations');
  } catch (error) {
    logger.error('Cleanup job failed:', error);
  }
}, 60 * 60 * 1000); // 1 hour

// Process pending story requests - run every 5 minutes
setInterval(async () => {
  try {
    const pendingRequests = await db.getPendingStoryRequests();
    
    for (const request of pendingRequests) {
      logger.info(`Processing pending story request: ${request.id}`);
      await smsHandler.processStoryRequest(request);
    }
  } catch (error) {
    logger.error('Failed to process pending story requests:', error);
  }
}, 5 * 60 * 1000); // 5 minutes

// Start server
const PORT = config.server.port;
app.listen(PORT, () => {
  logger.info(`OldVoice SMS server running on port ${PORT}`);
  logger.info(`Environment: ${config.server.nodeEnv}`);
  
  // Test database connection
  db.createOrGetUser('+10000000000')
    .then(() => logger.info('Database connection successful'))
    .catch(err => logger.error('Database connection failed:', err));
    
  // Test Redis connection
  redis.get('test')
    .then(() => logger.info('Redis connection successful'))
    .catch(err => logger.error('Redis connection failed:', err));
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  // Close Redis connection
  await redis.cleanup();
  
  process.exit(0);
});

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});