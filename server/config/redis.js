import { createClient } from 'redis';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI || 'redis://127.0.0.1:6379';

const client = createClient({
  url: redisUrl,
  socket: {
    reconnectStrategy: (retries) => {
      // Limit reconnect retries to avoid flooding logs if Redis is down
      if (retries > 5) {
        return new Error('[Redis] Max reconnection attempts reached.');
      }
      return Math.min(retries * 200, 2000);
    },
  },
});

let isConnected = false;

client.on('error', (err) => {
  if (isConnected) {
    console.error('[Redis Client Error]:', err.message);
  }
});

client.on('ready', () => {
  console.log('[Redis] Connected and ready.');
  isConnected = true;
});

client.on('connect', () => {
  isConnected = true;
});

client.on('end', () => {
  isConnected = false;
});

// Connect to Redis asynchronously
client.connect().catch((err) => {
  console.warn('[Redis] Connection failed. Using in-memory fallback for local development:', err.message);
});

// In-Memory fallback store for local development when Redis server is offline
const fallbackStore = new Map();
const fallbackTTL = new Map();

const redisWrapper = {
  isReady() {
    return isConnected && client.isReady;
  },

  client,

  async set(key, value, options) {
    if (this.isReady()) {
      return await client.set(key, value, options);
    }
    const ttl = options?.EX;
    fallbackStore.set(key, value);
    if (ttl) {
      const expiresAt = Date.now() + ttl * 1000;
      fallbackTTL.set(key, expiresAt);
      setTimeout(() => {
        if (fallbackTTL.get(key) === expiresAt) {
          fallbackStore.delete(key);
          fallbackTTL.delete(key);
        }
      }, ttl * 1000);
    }
    return 'OK';
  },

  async get(key) {
    if (this.isReady()) {
      return await client.get(key);
    }
    const expiresAt = fallbackTTL.get(key);
    if (expiresAt && Date.now() > expiresAt) {
      fallbackStore.delete(key);
      fallbackTTL.delete(key);
      return null;
    }
    return fallbackStore.get(key) || null;
  },

  async del(key) {
    if (this.isReady()) {
      return await client.del(key);
    }
    fallbackTTL.delete(key);
    return fallbackStore.delete(key) ? 1 : 0;
  },

  async incr(key) {
    if (this.isReady()) {
      return await client.incr(key);
    }
    const current = parseInt(fallbackStore.get(key) || '0', 10) + 1;
    fallbackStore.set(key, String(current));
    return current;
  },

  async expire(key, seconds) {
    if (this.isReady()) {
      return await client.expire(key, seconds);
    }
    const expiresAt = Date.now() + seconds * 1000;
    fallbackTTL.set(key, expiresAt);
    setTimeout(() => {
      if (fallbackTTL.get(key) === expiresAt) {
        fallbackStore.delete(key);
        fallbackTTL.delete(key);
      }
    }, seconds * 1000);
    return 1;
  },

  async ttl(key) {
    if (this.isReady()) {
      return await client.ttl(key);
    }
    const expiresAt = fallbackTTL.get(key);
    if (!expiresAt) return -1;
    const remaining = Math.ceil((expiresAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  },
};

export { client };
export default redisWrapper;
