import rateLimit from "express-rate-limit";

/**
 * General API rate limiter
 * Limits: 100 requests per 15 minutes per IP
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    message: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

/**
 * Rate limiter for authentication endpoints.
 *
 * Counts failures only, and is deliberately looser than it looks: a counselling
 * office shares one connection, so a tight per-IP cap on all attempts locked
 * out colleagues of whoever mistyped a password — and at 5 per 15 minutes it
 * also fired before the per-account lockout could ever engage, so the more
 * precise control never ran.
 *
 * The division of labour: this catches one machine spraying attempts across
 * many accounts; the per-account lockout in services/loginAttempts catches
 * attempts against a single account from anywhere.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  // A successful sign-in does not count, so ordinary use by a shared office
  // never approaches the limit however many people log in.
  skipSuccessfulRequests: true,
  message: {
    message: "Too many authentication attempts, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Upload rate limiter
 * Limits: 10 uploads per hour per IP
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 uploads per hour
  message: {
    message: "Too many file uploads, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Invite rate limiter
 * Limits: 20 invites per hour per IP
 *
 * The endpoint is head-counsellor-only, but it sends mail to a caller-supplied
 * address — this caps the blast radius if such an account is ever compromised.
 */
export const inviteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 invites per hour
  message: {
    message: "Too many invites sent, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Password change rate limiter
 * Limits: 3 password changes per hour per IP
 */
export const passwordChangeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password changes per hour
  message: {
    message: "Too many password change attempts, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
