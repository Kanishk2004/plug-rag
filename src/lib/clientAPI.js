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
		const url = searchParams.toString() ? `${endpoint}?${searchParams}` : endpoint;
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
		
		// Add files
		if (Array.isArray(files)) {
			files.forEach((file, index) => {
				formData.append('files', file);
			});
		} else {
			formData.append('file', files);
		}

		// Add other data
		Object.entries(data).forEach(([key, value]) => {
			formData.append(key, value);
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

	/**
	 * Toggle bot status (active/inactive)
	 */
	async toggleStatus(botId) {
		return apiClient.post(`/bots/${botId}/toggle-status`);
	},

	/**
	 * Get bot analytics
	 */
	async getAnalytics(botId) {
		return apiClient.get(`/bots/${botId}/analytics`);
	},
};

/**
 * File API - Frontend interface for file operations
 */
export const fileAPI = {
	/**
	 * Upload multiple files to a bot
	 */
	async uploadMultiple(files, botId, options = {}, onProgress = null) {
		const data = {
			botId,
			generateEmbeddings: options.generateEmbeddings ?? true,
			maxChunkSize: options.maxChunkSize || 700,
			overlap: options.overlap || 100,
			...options,
		};

		return apiClient.uploadFiles('/files', files, data, onProgress);
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