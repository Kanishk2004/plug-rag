/**
 * API utility functions for making HTTP requests
 */

// Custom error class for API errors
export class APIError extends Error {
	constructor(message, status, code = null, details = null) {
		super(message);
		this.name = 'APIError';
		this.status = status;
		this.code = code;
		this.details = details;
	}
}

// Base fetch wrapper with error handling
async function apiFetch(url, options = {}) {
	const defaultOptions = {
		headers: {
			'Content-Type': 'application/json',
			...options.headers,
		},
	};

	// Don't set Content-Type for FormData
	if (options.body instanceof FormData) {
		delete defaultOptions.headers['Content-Type'];
	}

	const response = await fetch(url, {
		...defaultOptions,
		...options,
	});

	const data = await response.json();

	if (!response.ok) {
		throw new APIError(
			data.error || `HTTP ${response.status}`,
			response.status,
			data.code,
			data.details
		);
	}

	return data;
}

/**
 * Bot API functions
 */
export const botAPI = {
	// Create a new bot
	async create(botData) {
		return await apiFetch('/api/bots', {
			method: 'POST',
			body: JSON.stringify(botData),
		});
	},

	// Get user's bots
	async list(options = {}) {
		const params = new URLSearchParams();
		if (options.page) params.append('page', options.page.toString());
		if (options.limit) params.append('limit', options.limit.toString());
		if (options.status) params.append('status', options.status);

		const url = `/api/bots${params.toString() ? '?' + params.toString() : ''}`;
		return await apiFetch(url);
	},
};

/**
 * File API functions
 */
export const fileAPI = {
	// Upload a file to a bot
	async upload(file, botId, options = {}) {
		const formData = new FormData();
		formData.append('file', file);
		formData.append('botId', botId);
		formData.append('options', JSON.stringify(options));

		return await apiFetch('/api/files', {
			method: 'POST',
			body: formData,
		});
	},

	// Upload multiple files with progress tracking
	async uploadMultiple(files, botId, options = {}, onProgress = null) {
		const results = [];
		const total = files.length;

		for (let i = 0; i < files.length; i++) {
			try {
				if (onProgress) {
					onProgress({
						fileIndex: i,
						fileName: files[i].name,
						status: 'uploading',
						progress: 0,
						total,
					});
				}

				const result = await this.upload(files[i], botId, {
					...options,
					generateEmbeddings: true, // Enable embeddings by default
				});

				if (onProgress) {
					onProgress({
						fileIndex: i,
						fileName: files[i].name,
						status: 'completed',
						progress: 100,
						total,
						result,
					});
				}

				results.push({ success: true, file: files[i], result });
			} catch (error) {
				if (onProgress) {
					onProgress({
						fileIndex: i,
						fileName: files[i].name,
						status: 'error',
						progress: 0,
						total,
						error,
					});
				}

				results.push({ success: false, file: files[i], error });
			}
		}

		return results;
	},

	// Get files for a bot
	async list(botId) {
		const params = new URLSearchParams({ botId });
		return await apiFetch(`/api/files?${params.toString()}`);
	},

	// Delete a file
	async delete(fileId) {
		const params = new URLSearchParams({ fileId });
		return await apiFetch(`/api/files?${params.toString()}`, {
			method: 'DELETE',
		});
	},
};

/**
 * Vector API functions
 */
export const vectorAPI = {
	// Get vector statistics for a bot
	async getStats(botId) {
		return await apiFetch(`/api/vectors/${botId}`);
	},

	// Initialize vector storage for a bot
	async initialize(botId) {
		return await apiFetch(`/api/vectors/${botId}`, {
			method: 'POST',
		});
	},

	// Process a file to vectors
	async processFile(botId, fileId) {
		return await apiFetch(`/api/vectors/process/${fileId}`, {
			method: 'POST',
			body: JSON.stringify({ botId }),
		});
	},
};

/**
 * Utility functions for handling API responses and errors
 */
export const apiUtils = {
	// Format file size for display
	formatFileSize(bytes) {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	},

	// Format error message for user display
	formatError(error) {
		if (error instanceof APIError) {
			switch (error.status) {
				case 401:
					return 'Please log in to continue.';
				case 403:
					return "You don't have permission to perform this action.";
				case 404:
					return 'The requested resource was not found.';
				case 409:
					return error.message || 'A conflict occurred. Please try again.';
				case 413:
					return 'File is too large. Please choose a smaller file.';
				case 415:
					return 'File type not supported. Please upload a PDF, DOCX, TXT, CSV, or HTML file.';
				case 429:
					return (
						error.message ||
						'You have reached your plan limits. Please upgrade or try again later.'
					);
				case 500:
					return 'Server error. Please try again later.';
				default:
					return error.message || 'An unexpected error occurred.';
			}
		}

		if (error.name === 'TypeError' && error.message.includes('fetch')) {
			return 'Network error. Please check your connection and try again.';
		}

		return error.message || 'An unexpected error occurred.';
	},

	// Validate file before upload
	validateFile(file, options = {}) {
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
				error: `File size must be less than ${this.formatFileSize(
					maxSize
				)}. Current size: ${this.formatFileSize(file.size)}`,
			};
		}

		if (!allowedTypes.includes(file.type)) {
			return {
				isValid: false,
				error: `File type ${file.type} is not supported. Please upload PDF, DOCX, TXT, CSV, or HTML files.`,
			};
		}

		return { isValid: true };
	},

	// Create a delay for testing/demo purposes
	delay(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	},

	// Retry function with exponential backoff
	async retry(fn, options = {}) {
		const {
			maxAttempts = 3,
			delayMs = 1000,
			backoffFactor = 2,
			onRetry = null,
		} = options;

		let lastError;

		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			try {
				return await fn();
			} catch (error) {
				lastError = error;

				if (attempt === maxAttempts) {
					break;
				}

				// Don't retry certain errors
				if (error instanceof APIError) {
					if (error.status < 500) {
						break; // Client errors shouldn't be retried
					}
				}

				const delay = delayMs * Math.pow(backoffFactor, attempt - 1);

				if (onRetry) {
					onRetry(attempt, error, delay);
				}

				await this.delay(delay);
			}
		}

		throw lastError;
	},
};

const api = {
	botAPI,
	fileAPI,
	vectorAPI,
	apiUtils,
	APIError,
};

export default api;
