import redisWrapper from '../config/redis.js';
import { sanitizeHeader } from '../services/emailService.js';

/**
 * Rate limit configuration constants
 */
const IP_LIMIT = 5;               // Max 5 requests
const IP_WINDOW_SECONDS = 900;    // 15 minutes in seconds

const RECIPIENT_LIMIT = 3;        // Max 3 emails per recipient
const RECIPIENT_WINDOW_SECONDS = 3600; // 1 hour in seconds

/**
 * Atomically increment request count and ensure TTL is set in Redis
 * @param {string} key - Redis key
 * @param {number} maxLimit - Maximum requests allowed in window
 * @param {number} windowSeconds - Window duration in seconds
 */
const checkLimit = async (key, maxLimit, windowSeconds) => {
  const count = await redisWrapper.incr(key);

  // If this is the first request in the window, initialize the TTL
  if (count === 1) {
    await redisWrapper.expire(key, windowSeconds);
  }

  let ttl = await redisWrapper.ttl(key);

  // Fallback if key exists without TTL
  if (ttl === -1) {
    await redisWrapper.expire(key, windowSeconds);
    ttl = windowSeconds;
  }

  return {
    allowed: count <= maxLimit,
    count,
    ttl: Math.max(ttl, 1),
  };
};

/**
 * Redis-powered Dual-Tier Rate Limiting Middleware
 * Tier 1: Client IP (Max 5 requests per 15 minutes)
 * Tier 2: Target Recipient (Max 3 requests per recipient per hour)
 */
export const emailRateLimiter = async (req, res, next) => {
  try {
    // 1. Resolve client IP (relies on app.set('trust proxy', 1))
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
    const ipKey = `ratelimit:email:ip:${clientIp}`;

    // Check Tier 1: Client IP
    const ipResult = await checkLimit(ipKey, IP_LIMIT, IP_WINDOW_SECONDS);

    if (!ipResult.allowed) {
      res.set('Retry-After', String(ipResult.ttl));
      return res.status(429).json({
        success: false,
        error: 'Too many email requests from this IP. Please try again later.',
        retryAfter: ipResult.ttl,
      });
    }

    // 2. Check Tier 2: Target Recipient (req.body.to or req.body.email)
    const recipient = req.body?.to || req.body?.email;

    if (recipient && typeof recipient === 'string') {
      const sanitizedRecipient = sanitizeHeader(recipient).toLowerCase();

      if (sanitizedRecipient) {
        const recipientKey = `ratelimit:email:recipient:${sanitizedRecipient}`;
        const recipientResult = await checkLimit(recipientKey, RECIPIENT_LIMIT, RECIPIENT_WINDOW_SECONDS);

        if (!recipientResult.allowed) {
          res.set('Retry-After', String(recipientResult.ttl));
          return res.status(429).json({
            success: false,
            error: 'Too many emails sent to this recipient. Please try again later to prevent inbox spam.',
            retryAfter: recipientResult.ttl,
          });
        }
      }
    }

    next();
  } catch (error) {
    console.error('[RateLimiter Error]:', error.message);
    console.warn('[RateLimiter] Allowing request to proceed due to rate limiter service error.');
    next();
  }
};

export default emailRateLimiter;
