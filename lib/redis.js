const redis = require('redis');
const config = require('../config');

let client;

async function getClient() {
  if (!client) {
    client = redis.createClient({
      url: config.redis.url
    });
    
    client.on('error', (err) => {
      console.error('Redis client error:', err);
    });
    
    client.on('connect', () => {
      console.log('Connected to Redis');
    });
    
    await client.connect();
  }
  
  return client;
}

const redisService = {
  async set(key, value, expirySeconds = 3600) {
    const client = await getClient();
    await client.setEx(key, expirySeconds, JSON.stringify(value));
  },
  
  async get(key) {
    const client = await getClient();
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  },
  
  async del(key) {
    const client = await getClient();
    await client.del(key);
  },
  
  async exists(key) {
    const client = await getClient();
    return await client.exists(key);
  },
  
  // Conversation-specific methods
  async getConversationState(phoneNumber) {
    return await this.get(`conv:${phoneNumber}`);
  },
  
  async setConversationState(phoneNumber, state, expirySeconds = 3600) {
    await this.set(`conv:${phoneNumber}`, state, expirySeconds);
  },
  
  async deleteConversationState(phoneNumber) {
    await this.del(`conv:${phoneNumber}`);
  },
  
  // Rate limiting
  async checkRateLimit(phoneNumber, maxRequests = 50, windowSeconds = 3600) {
    const client = await getClient();
    const key = `rate:${phoneNumber}`;
    
    const current = await client.incr(key);
    
    if (current === 1) {
      await client.expire(key, windowSeconds);
    }
    
    return {
      allowed: current <= maxRequests,
      remaining: Math.max(0, maxRequests - current),
      resetIn: await client.ttl(key)
    };
  },
  
  // Cleanup
  async cleanup() {
    if (client) {
      await client.quit();
      client = null;
    }
  }
};

module.exports = redisService;