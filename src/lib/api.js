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
	// Upload a file
	async upload(file, botId) {
		const formData = new FormData();
		formData.append('file', file);
		formData.append('botId', botId);

		return await apiFetch('/api/files', {
			method: 'POST',
			body: formData,
		});
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
};

const api = {
	botAPI,
	fileAPI,
	chatAPI,
	apiUtils,
	APIError,
};

export default api;
