/**
 * Simple API utility functions for making HTTP requests
 */

// Custom error class for API errors
export class APIError extends Error {
	constructor(message, status, code = null) {
		super(message);
		this.name = 'APIError';
		this.status = status;
		this.code = code;
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
			data.code
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
	async list() {
		return await apiFetch('/api/bots');
	},

	// Get bot by ID
	async get(id) {
		return await apiFetch(`/api/bots/${id}`);
	},

	// Update bot
	async update(id, botData) {
		return await apiFetch(`/api/bots/${id}`, {
			method: 'PATCH',
			body: JSON.stringify(botData),
		});
	},

	// Delete bot
	async delete(id) {
		return await apiFetch(`/api/bots/${id}`, {
			method: 'DELETE',
		});
	},
};

/**
 * File API functions
 */
export const fileAPI = {
	// Upload a single file (simple version)
	// async upload(file, botId) {
	// 	const formData = new FormData();
	// 	formData.append('file', file);
	// 	formData.append('botId', botId);

	// 	return await apiFetch('/api/files', {
	// 		method: 'POST',
	// 		body: formData,
	// 	});
	// },

	// Upload multiple files with progress tracking and options
	async uploadMultiple(files, botId, options = {}, onProgress = null) {
		const {
			generateEmbeddings = true,
			maxChunkSize = 700,
			overlap = 100,
		} = options;

		const results = [];
		const total = files.length;

		for (let i = 0; i < files.length; i++) {
			const file = files[i];

			try {
				// Notify progress - uploading
				if (onProgress) {
					onProgress({
						fileIndex: i,
						fileName: file.name,
						status: 'uploading',
						total: total,
					});
				}

				const formData = new FormData();
				formData.append('file', file);
				formData.append('botId', botId);
				formData.append('generateEmbeddings', generateEmbeddings.toString());
				formData.append('maxChunkSize', maxChunkSize.toString());
				formData.append('overlap', overlap.toString());

				console.log(
					'API CALL - /api/files from /lib/api.js file with formData: ',
					{
						fileName: file.name,
						botId: botId,
						generateEmbeddings: generateEmbeddings.toString(),
						maxChunkSize: maxChunkSize.toString(),
						overlap: overlap.toString()
					}
				);
				const result = await apiFetch('/api/files', {
					method: 'POST',
					body: formData,
				});

				results.push({ 
					file: file.name, 
					success: true, 
					result,
					tokensUsed: result.tokensUsed || 0,
					estimatedCost: result.estimatedCost || 0,
					chunksCreated: result.chunksCreated || 0,
					vectorsCreated: result.vectorsCreated || 0
				});

				// Notify progress - completed
				if (onProgress) {
					onProgress({
						fileIndex: i,
						fileName: file.name,
						status: 'completed',
						total: total,
					});
				}
			} catch (error) {
				results.push({
					file: file.name,
					success: false,
					error: error.message,
				});

				// Notify progress - error
				if (onProgress) {
					onProgress({
						fileIndex: i,
						fileName: file.name,
						status: 'error',
						total: total,
						error: error.message,
					});
				}
			}
		}

		return {
			success: results.every((r) => r.success),
			results,
			uploadedCount: results.filter((r) => r.success).length,
			errorCount: results.filter((r) => !r.success).length,
			totalTokensUsed: results.reduce((sum, r) => sum + (r.tokensUsed || 0), 0),
			totalEstimatedCost: results.reduce((sum, r) => sum + (r.estimatedCost || 0), 0),
			totalChunksCreated: results.reduce((sum, r) => sum + (r.chunksCreated || 0), 0),
			totalVectorsCreated: results.reduce((sum, r) => sum + (r.vectorsCreated || 0), 0),
		};
	},

	// Get files
	async list() {
		return await apiFetch('/api/files');
	},

	// Delete a file
	async delete(id) {
		return await apiFetch(`/api/files/${id}`, {
			method: 'DELETE',
		});
	},
};

/**
 * Chat API functions
 */
export const chatAPI = {
	// Send a message
	async sendMessage(botId, message, sessionId = null) {
		return await apiFetch(`/api/chat/${botId}`, {
			method: 'POST',
			body: JSON.stringify({ message, sessionId }),
		});
	},

	// Get conversation history
	async getHistory(botId) {
		return await apiFetch(`/api/chat/${botId}`);
	},

	// Clear conversation history
	async clearHistory(botId) {
		return await apiFetch(`/api/chat/${botId}`, {
			method: 'DELETE',
		});
	},
};

/**
 * Utility functions
 */
export const apiUtils = {
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
				case 500:
					return 'Server error. Please try again later.';
				case 501:
					return 'This feature is not yet implemented.';
				default:
					return error.message || 'An unexpected error occurred.';
			}
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

	// Format file size for display
	formatFileSize(bytes) {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	},
};

const api = {
	botAPI,
	fileAPI,
	chatAPI,
	apiUtils,
	APIError,
};

export default api;
