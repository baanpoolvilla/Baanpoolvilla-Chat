import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts, please try again after 1 minute' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 2000,
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
  // Webhooks arrive from platform servers (LINE/Meta), not individual users.
  // Use a single global bucket so all platform IPs share a high limit together.
  keyGenerator: () => 'webhook-global',
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: 'Too many API requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});
