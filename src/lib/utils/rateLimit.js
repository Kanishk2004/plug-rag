/**
 * Rate Limiting Utility
 *
 * Implements both IP-based and session-based rate limiting for chat endpoints
 * Uses in-memory storage for MVP (consider Redis for production)
 */

import { validationError } from './apiResponse.js';

// In-memory storage for rate limits
const ipLimitStore = new Map();
const sessionLimitStore = new Map();

// Rate limit configuration
const RATE_LIMITS = {
	ip: {
		windowMs: 60 * 60 * 1000, // 1 hour
		maxRequests: 100, // 100 requests per hour per IP
	},
	session: {
		windowMs: 60 * 60 * 1000, // 1 hour
		maxRequests: 50, // 50 messages per hour per session
	},
};

/**
 * Clean up expired entries from rate limit store
 */
function cleanupExpiredEntries(store) {
	const now = Date.now();
	for (const [key, value] of store.entries()) {
		if (value.resetAt < now) {
			store.delete(key);
		}
	}
}

/**
 * Check rate limit for a given key
 */
function checkLimit(store, key, maxRequests, windowMs) {
	const now = Date.now();
	const record = store.get(key);

	// No existing record or expired - create new
	if (!record || record.resetAt < now) {
		const resetAt = now + windowMs;
		store.set(key, { count: 1, resetAt });
		return {
			allowed: true,
			remaining: maxRequests - 1,
			resetAt,
		};
	}

	// Existing record - check if limit exceeded
	if (record.count >= maxRequests) {
		return {
			allowed: false,
			remaining: 0,
			resetAt: record.resetAt,
		};
	}

	// Increment count
	record.count++;
	store.set(key, record);

	return {
		allowed: true,
		remaining: maxRequests - record.count,
		resetAt: record.resetAt,
	};
}

/**
 * Extract client IP from request headers
 */
export function getClientIp(request) {
	const headers = request.headers;

	// Cloudflare
	const cfConnectingIp = headers.get('cf-connecting-ip');
	if (cfConnectingIp) return cfConnectingIp;

	// General proxy headers
	const xForwardedFor = headers.get('x-forwarded-for');
	if (xForwardedFor) {
		return xForwardedFor.split(',')[0].trim();
	}

	const xRealIp = headers.get('x-real-ip');
	if (xRealIp) return xRealIp;

	return 'unknown';
}

/**
 * Rate limit middleware for chat endpoints
 */
export function checkRateLimit(request, sessionId) {
	// Cleanup expired entries periodically
	if (Math.random() < 0.01) {
		cleanupExpiredEntries(ipLimitStore);
		cleanupExpiredEntries(sessionLimitStore);
	}

	const clientIp = getClientIp(request);

	// Check IP-based rate limit
	const ipLimit = checkLimit(
		ipLimitStore,
		clientIp,
		RATE_LIMITS.ip.maxRequests,
		RATE_LIMITS.ip.windowMs
	);

	if (!ipLimit.allowed) {
		const resetIn = Math.ceil((ipLimit.resetAt - Date.now()) / 1000 / 60);
		return validationError(
			`Rate limit exceeded. Too many requests from your IP address. Try again in ${resetIn} minutes.`,
			{
				rateLimitType: 'ip',
				retryAfter: resetIn,
				limit: RATE_LIMITS.ip.maxRequests,
				window: '1 hour',
			}
		);
	}

	// Check session-based rate limit
	if (sessionId) {
		const sessionLimit = checkLimit(
			sessionLimitStore,
			sessionId,
			RATE_LIMITS.session.maxRequests,
			RATE_LIMITS.session.windowMs
		);

		if (!sessionLimit.allowed) {
			const resetIn = Math.ceil(
				(sessionLimit.resetAt - Date.now()) / 1000 / 60
			);
			return validationError(
				`Rate limit exceeded. Too many messages in this session. Try again in ${resetIn} minutes.`,
				{
					rateLimitType: 'session',
					retryAfter: resetIn,
					limit: RATE_LIMITS.session.maxRequests,
					window: '1 hour',
				}
			);
		}
	}

	return null;
}

/**
 * Clear rate limit for specific IP or session (testing/admin use)
 */
export function clearRateLimit(type, key) {
	if (type === 'ip') {
		ipLimitStore.delete(key);
	} else if (type === 'session') {
		sessionLimitStore.delete(key);
	}
}
