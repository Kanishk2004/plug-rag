/**
 * API Utilities
 * 
 * Provides utility functions for API operations including error formatting,
 * file validation, and common helper functions for the frontend.
 */

/**
 * Format API errors for display to users
 * @param {Error|Object} error - Error object or API response
 * @returns {string} Formatted error message
 */
export function formatError(error) {
	// Handle API response errors
	if (error.response) {
		const status = error.response.status;
		const data = error.response.data;
		
		// Return specific error message from API if available
		if (data?.error || data?.message) {
			return data.error || data.message;
		}
		
		// Return generic messages for common status codes
		switch (status) {
			case 400:
				return 'Invalid request. Please check your input and try again.';
			case 401:
				return 'You are not authorized to perform this action. Please sign in.';
			case 403:
				return 'You do not have permission to perform this action.';
			case 404:
				return 'The requested resource was not found.';
			case 500:
				return 'Server error. Please try again later.';
			case 501:
				return 'This feature is not yet implemented.';
			default:
				return error.message || 'An unexpected error occurred.';
		}
	}

	return error.message || 'An unexpected error occurred.';
}

/**
 * Validate file before upload
 * @param {File} file - File object to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
export function validateFile(file, options = {}) {
	const {
		maxSize = 30 * 1024 * 1024, // 30MB default
		allowedTypes = [
			'application/pdf',
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			'application/msword',
			'text/plain',
			'text/csv',
			'text/html',
		],
	} = options;

	if (file.size > maxSize) {
		return {
			isValid: false,
			error: `File size must be less than ${formatFileSize(
				maxSize
			)}. Current size: ${formatFileSize(file.size)}`,
		};
	}

	if (!allowedTypes.includes(file.type)) {
		return {
			isValid: false,
			error: `File type ${file.type} is not supported. Please upload PDF, DOCX, TXT, CSV, or HTML files.`,
		};
	}

	return { isValid: true };
}

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
export function formatFileSize(bytes) {
	if (bytes === 0) return '0 Bytes';
	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Create a delay for user feedback
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} Delay promise
 */
export function delay(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a unique ID for frontend use
 * @returns {string} Unique identifier
 */
export function generateId() {
	return Math.random().toString(36).substr(2, 9);
}

/**
 * Check if an object is empty
 * @param {Object} obj - Object to check
 * @returns {boolean} Whether object is empty
 */
export function isEmpty(obj) {
	return Object.keys(obj).length === 0;
}

/**
 * Safely parse JSON string
 * @param {string} str - JSON string to parse
 * @param {*} fallback - Fallback value if parsing fails
 * @returns {*} Parsed object or fallback
 */
export function safeParseJSON(str, fallback = null) {
	try {
		return JSON.parse(str);
	} catch (error) {
		return fallback;
	}
}

/**
 * Debounce function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
	let timeout;
	return function executedFunction(...args) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
}

/**
 * Throttle function calls
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, limit) {
	let inThrottle;
	return function executedFunction(...args) {
		if (!inThrottle) {
			func.apply(this, args);
			inThrottle = true;
			setTimeout(() => inThrottle = false, limit);
		}
	};
}

// Export all utilities as default object for backward compatibility
const apiUtils = {
	formatError,
	validateFile,
	formatFileSize,
	delay,
	generateId,
	isEmpty,
	safeParseJSON,
	debounce,
	throttle,
};

export default apiUtils;
