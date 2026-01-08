/**
 * Input Sanitization and Validation Utilities
 * Protects against injection attacks and ensures data integrity
 */

/**
 * Sanitize text input - remove dangerous characters
 */
export function sanitizeText(input, maxLength = 10000) {
	if (typeof input !== 'string') {
		return '';
	}

	let sanitized = input.trim();

	// Enforce max length
	if (sanitized.length > maxLength) {
		sanitized = sanitized.substring(0, maxLength);
	}

	// Remove null bytes
	sanitized = sanitized.replace(/\0/g, '');

	// Remove control characters except newlines and tabs
	sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

	return sanitized;
}

/**
 * Validate and sanitize chat message
 */
export function validateChatMessage(message) {
	if (!message || typeof message !== 'string') {
		return {
			valid: false,
			sanitized: '',
			error: 'Message must be a non-empty string',
		};
	}

	const sanitized = sanitizeText(message, 5000);

	if (sanitized.length < 1) {
		return {
			valid: false,
			sanitized: '',
			error: 'Message cannot be empty',
		};
	}

	if (sanitized.length > 5000) {
		return {
			valid: false,
			sanitized: sanitized.substring(0, 5000),
			error: 'Message too long (maximum 5000 characters)',
		};
	}

	// Check for potential NoSQL injection patterns
	const dangerousPatterns = [
		/\$where/i,
		/\$ne/i,
		/\$gt/i,
		/\$lt/i,
		/\$regex/i,
		/javascript:/i,
	];

	const hasDangerousPattern = dangerousPatterns.some((pattern) =>
		pattern.test(sanitized)
	);

	if (hasDangerousPattern) {
		console.warn('[SECURITY] Potential injection attempt detected:', {
			message: sanitized.substring(0, 100),
		});
	}

	return {
		valid: true,
		sanitized,
		error: null,
	};
}

/**
 * Sanitize session ID
 */
export function validateSessionId(sessionId) {
	if (!sessionId || typeof sessionId !== 'string') {
		return {
			valid: false,
			sanitized: '',
			error: 'Session ID must be provided',
		};
	}

	// Remove any non-alphanumeric characters except hyphens and underscores
	const sanitized = sessionId.replace(/[^a-zA-Z0-9_-]/g, '');

	if (sanitized.length < 5 || sanitized.length > 100) {
		return {
			valid: false,
			sanitized,
			error: 'Session ID must be between 5 and 100 characters',
		};
	}

	return {
		valid: true,
		sanitized,
		error: null,
	};
}

/**
 * Sanitize domain name
 */
export function sanitizeDomain(domain) {
	if (!domain || typeof domain !== 'string') {
		return 'unknown';
	}

	let sanitized = domain.replace(/^https?:\/\//, '');
	sanitized = sanitized.split('/')[0].split('?')[0];
	sanitized = sanitized.toLowerCase().trim();

	if (sanitized.length > 253) {
		sanitized = sanitized.substring(0, 253);
	}

	return sanitized || 'unknown';
}

/**
 * Sanitize user fingerprint
 */
export function sanitizeFingerprint(fingerprint) {
	if (!fingerprint || typeof fingerprint !== 'string') {
		return '';
	}

	const sanitized = fingerprint
		.replace(/[^a-zA-Z0-9_-]/g, '')
		.substring(0, 100);
	return sanitized;
}
