/**
 * Frontend API Layer
 *
 * Provides a clean, consistent interface for frontend components to interact
 * with backend services. This layer handles HTTP requests and response formatting.
 */

import { formatError } from './utils/apiUtils.js';

/**
 * Base API client for making HTTP requests
 */
class APIClient {
	constructor(baseURL = '/api') {
		this.baseURL = baseURL;
	}

	async request(endpoint, options = {}) {
		const url = `${this.baseURL}${endpoint}`;
		const config = {
			headers: {
				'Content-Type': 'application/json',
				...options.headers,
			},
			...options,
		};

		try {
			const response = await fetch(url, config);
			const data = await response.json();

			if (!response.ok) {
				throw { response: { status: response.status, data } };
			}

			return { data: data.data, success: true };
		} catch (error) {
			console.error(`API Error [${endpoint}]:`, error);
			throw error;
		}
	}

	async get(endpoint, params = {}) {
		const searchParams = new URLSearchParams(params);
		const url = searchParams.toString()
			? `${endpoint}?${searchParams}`
			: endpoint;
		return this.request(url, { method: 'GET' });
	}

	async post(endpoint, data = {}) {
		return this.request(endpoint, {
			method: 'POST',
			body: JSON.stringify(data),
		});
	}

	async put(endpoint, data = {}) {
		return this.request(endpoint, {
			method: 'PUT',
			body: JSON.stringify(data),
		});
	}

	async delete(endpoint) {
		return this.request(endpoint, { method: 'DELETE' });
	}

	async uploadFiles(endpoint, files, data = {}, onProgress = null) {
		const formData = new FormData();

		// Add files - handle both single file and array of files
		if (Array.isArray(files)) {
			// For multiple files, append each with individual field names
			files.forEach((file, index) => {
				if (file && file instanceof File) {
					formData.append('file', file); // Backend expects 'file' field name
				}
			});
		} else if (files && files instanceof File) {
			// Single file upload
			formData.append('file', files);
		} else {
			console.error('Invalid file data provided:', files);
			throw new Error('Invalid file data provided');
		}

		// Add other data
		Object.entries(data).forEach(([key, value]) => {
			if (value !== undefined && value !== null) {
				formData.append(key, String(value));
			}
		});

		try {
			const response = await fetch(`${this.baseURL}${endpoint}`, {
				method: 'POST',
				body: formData,
			});

			const result = await response.json();

			if (!response.ok) {
				throw { response: { status: response.status, data: result } };
			}

			return { data: result.data, success: true };
		} catch (error) {
			console.error(`Upload Error [${endpoint}]:`, error);
			throw error;
		}
	}
}

const apiClient = new APIClient();

/**
 * Bot API - Frontend interface for bot operations
 */
export const botAPI = {
	/**
	 * Create a new bot
	 */
	async create(botData) {
		return apiClient.post('/bots', botData);
	},

	/**
	 * Get user's bots with pagination
	 */
	async list(options = {}) {
		return apiClient.get('/bots', options);
	},

	/**
	 * Get specific bot by ID
	 */
	async getById(botId) {
		return apiClient.get(`/bots/${botId}`);
	},

	/**
	 * Update bot information
	 */
	async update(botId, updates) {
		return apiClient.put(`/bots/${botId}`, updates);
	},

	/**
	 * Delete a bot
	 */
	async delete(botId) {
		return apiClient.delete(`/bots/${botId}`);
	},
};

/**
 * File API - Frontend interface for file operations
 */
export const fileAPI = {
	/**
	 * Upload a single file to a bot
	 */
	async upload(file, botId, options = {}) {
		const data = {
			botId,
			generateEmbeddings: options.generateEmbeddings ?? true,
			maxChunkSize: options.maxChunkSize || 700,
			overlap: options.overlap || 100,
			...options,
		};

		return apiClient.uploadFiles('/files', file, data);
	},

	/**
	 * Upload multiple files to a bot (uploads them one by one)
	 */
	async uploadMultiple(files, botId, options = {}, onProgress = null) {
		if (!Array.isArray(files)) {
			files = [files];
		}

		const results = [];
		let totalTokensUsed = 0;
		let totalEstimatedCost = 0;
		let uploadedCount = 0;
		let errorCount = 0;

		for (let i = 0; i < files.length; i++) {
			const file = files[i];

			try {
				// Call progress callback if provided
				if (onProgress) {
					onProgress({
						fileName: file.name,
						progress: i,
						total: files.length,
						status: 'uploading',
					});
				}

				const result = await this.upload(file, botId, options);

				if (result.success) {
					uploadedCount++;
					totalTokensUsed += result.data.tokensUsed || 0;
					totalEstimatedCost += result.data.estimatedCost || 0;

					results.push({
						file: file.name,
						success: true,
						data: result.data,
					});

					if (onProgress) {
						onProgress({
							fileName: file.name,
							progress: i + 1,
							total: files.length,
							status: 'completed',
						});
					}
				} else {
					errorCount++;
					results.push({
						file: file.name,
						success: false,
						error: 'Upload failed',
					});
				}
			} catch (error) {
				errorCount++;
				console.error(`Failed to upload ${file.name}:`, error);

				results.push({
					file: file.name,
					success: false,
					error:
						error.response?.data?.error || error.message || 'Upload failed',
				});

				if (onProgress) {
					onProgress({
						fileName: file.name,
						progress: i + 1,
						total: files.length,
						status: 'error',
					});
				}
			}
		}

		return {
			success: errorCount === 0,
			results,
			uploadedCount,
			errorCount,
			totalTokensUsed,
			totalEstimatedCost,
		};
	},

	/**
	 * Get files for a bot
	 */
	async list(botId, options = {}) {
		return apiClient.get('/files', { botId, ...options });
	},

	/**
	 * Delete a file
	 */
	async delete(fileId) {
		return apiClient.delete(`/files/${fileId}`);
	},
};

/**
 * Chat API - Frontend interface for chat operations
 */
export const chatAPI = {
	/**
	 * Send a message to a bot
	 */
	async sendMessage(botId, message, sessionId) {
		return apiClient.post(`/chat/${botId}`, {
			message,
			sessionId,
		});
	},

	/**
	 * Get conversation history
	 */
	async getHistory(botId, sessionId) {
		return apiClient.get(`/chat/${botId}`, { sessionId });
	},

	/**
	 * Clear conversation history
	 */
	async clearHistory(botId, sessionId) {
		return apiClient.delete(`/chat/${botId}?sessionId=${sessionId}`);
	},
};

/**
 * Export API utilities for backward compatibility
 */
export { default as apiUtils } from './utils/apiUtils.js';

/**
 * Default export for backward compatibility
 */
const api = {
	botAPI,
	fileAPI,
	chatAPI,
};

export default api;
