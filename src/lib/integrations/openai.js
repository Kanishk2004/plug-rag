import OpenAI from 'openai';
import { logInfo, logError } from '../utils/logger.js';

/**
 * OpenAI API Integration Service
 * Handles OpenAI API interactions, key validation, and model testing
 */

/**
 * Create OpenAI client instance
 * @param {string} apiKey - OpenAI API key
 * @param {Object} options - Client options
 * @returns {OpenAI} OpenAI client instance
 */
export function createOpenAIClient(apiKey, options = {}) {
  return new OpenAI({
    apiKey,
    timeout: options.timeout || 30000,
    ...options
  });
}

/**
 * Test OpenAI API key validity and supported features
 * Performs minimal API calls to validate the key without significant cost
 * @param {string} apiKey - The OpenAI API key to validate
 * @returns {Promise<Object>} Validation result with capabilities
 */
export async function validateOpenAIKey(apiKey) {
	try {
		// Create OpenAI client with the provided key
		const client = createOpenAIClient(apiKey, { timeout: 10000 });

		logInfo('Validating OpenAI API key', { keyHash: apiKey.substring(0, 7) + '...' });

		// Test 1: List available models to verify key validity
		const modelsResponse = await client.models.list();
		const availableModels = modelsResponse.data.map((model) => model.id);

		// Test 2: Perform a minimal embedding test (very low cost)
		const embeddingTest = await client.embeddings.create({
			model: 'text-embedding-3-small',
			input: 'test',
			encoding_format: 'float',
		});

		// Test 3: Perform a minimal chat completion test (low cost)
		const chatTest = await client.chat.completions.create({
			model: 'gpt-3.5-turbo',
			messages: [{ role: 'user', content: 'Hi' }],
			max_tokens: 5,
			temperature: 0,
		});

		// Determine supported models based on availability
		const supportedModels = {
			chat: availableModels.filter(
				(model) =>
					model.includes('gpt-4') ||
					model.includes('gpt-3.5-turbo') ||
					model.includes('gpt-4o')
			),
			embeddings: availableModels.filter((model) =>
				model.includes('text-embedding')
			),
		};

		// Calculate estimated costs for the validation tests
		const validationCosts = {
			embedding: embeddingTest.usage
				? {
						tokens: embeddingTest.usage.total_tokens,
						estimatedCost: (embeddingTest.usage.total_tokens / 1000) * 0.00002, // $0.00002 per 1K tokens
				  }
				: null,
			chat: chatTest.usage
				? {
						tokens: chatTest.usage.total_tokens,
						estimatedCost: (chatTest.usage.total_tokens / 1000) * 0.0005, // Rough estimate for GPT-3.5
				  }
				: null,
		};

		logInfo('OpenAI key validation successful', {
			modelsCount: availableModels.length,
			chatModels: supportedModels.chat.length,
			embeddingModels: supportedModels.embeddings.length
		});

		return {
			isValid: true,
			supportedModels,
			capabilities: {
				chat: chatTest.choices?.length > 0,
				embeddings: embeddingTest.data?.length > 0,
				modelsCount: availableModels.length,
			},
			validationCosts,
			testedAt: new Date().toISOString(),
		};
	} catch (error) {
		// Parse OpenAI error responses for user-friendly messages
		const validationError = parseOpenAIError(error);

		logError('OpenAI key validation failed', {
			error: validationError.message,
			code: validationError.code,
			status: error.status
		});

		return {
			isValid: false,
			error: validationError.message,
			errorCode: validationError.code,
			status: error.status,
			testedAt: new Date().toISOString(),
		};
	}
}

/**
 * Parse OpenAI API errors into user-friendly messages
 * @param {Error} error - The error from OpenAI API
 * @returns {Object} Parsed error with code and message
 */
function parseOpenAIError(error) {
	const status = error.status || error.code;

	switch (status) {
		case 401:
			return {
				code: 'INVALID_KEY',
				message:
					'Invalid API key. Please check that your API key is correct and active.',
			};

		case 429:
			return {
				code: 'RATE_LIMIT',
				message:
					'Rate limit exceeded or quota exhausted. Please check your OpenAI usage limits.',
			};

		case 403:
			return {
				code: 'INSUFFICIENT_PERMISSIONS',
				message:
					'API key does not have required permissions. Ensure your key has access to chat completions and embeddings.',
			};

		case 404:
			return {
				code: 'MODEL_NOT_FOUND',
				message:
					'One or more required models are not available with this API key.',
			};

		case 500:
		case 502:
		case 503:
			return {
				code: 'SERVICE_UNAVAILABLE',
				message:
					'OpenAI service is temporarily unavailable. Please try again later.',
			};

		case 'ENOTFOUND':
		case 'ETIMEDOUT':
			return {
				code: 'NETWORK_ERROR',
				message:
					'Network error connecting to OpenAI. Please check your internet connection.',
			};

		default:
			return {
				code: 'UNKNOWN_ERROR',
				message:
					error.message ||
					'An unexpected error occurred while validating the API key.',
			};
	}
}

/**
 * Test specific model availability with an API key
 * @param {string} apiKey - The OpenAI API key
 * @param {string} modelName - The model to test
 * @returns {Promise<boolean>} Whether the model is available
 */
export async function testModelAvailability(apiKey, modelName) {
	try {
		const client = createOpenAIClient(apiKey);

		logInfo('Testing model availability', { modelName });

		// Test based on model type
		if (modelName.includes('embedding')) {
			const result = await client.embeddings.create({
				model: modelName,
				input: 'test',
				encoding_format: 'float',
			});
			return result.data && result.data.length > 0;
		} else {
			const result = await client.chat.completions.create({
				model: modelName,
				messages: [{ role: 'user', content: 'Hi' }],
				max_tokens: 1,
			});
			return result.choices && result.choices.length > 0;
		}
	} catch (error) {
		logError('Model availability test failed', { modelName, error: error.message });
		return false;
	}
}

/**
 * Get estimated pricing for different models (as of 2024)
 * These prices may change - consider fetching from OpenAI pricing API in production
 * @param {string} modelName - The model name
 * @returns {Object} Pricing information
 */
export function getModelPricing(modelName) {
	const pricing = {
		// Chat models (per 1K tokens)
		'gpt-4': { input: 0.03, output: 0.06 },
		'gpt-4-turbo': { input: 0.01, output: 0.03 },
		'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },

		// Embedding models (per 1K tokens)
		'text-embedding-3-small': { input: 0.00002, output: 0 },
		'text-embedding-3-large': { input: 0.00013, output: 0 },
	};

	return pricing[modelName] || { input: 0, output: 0, unknown: true };
}

/**
 * Generate chat completion using OpenAI
 * @param {string} apiKey - OpenAI API key
 * @param {Object} params - Chat completion parameters
 * @returns {Promise<Object>} Chat completion response
 */
export async function generateChatCompletion(apiKey, params) {
	try {
		const client = createOpenAIClient(apiKey);
		
		const completion = await client.chat.completions.create({
			model: 'gpt-3.5-turbo',
			max_tokens: 1500,
			temperature: 0.7,
			...params
		});

		logInfo('Chat completion generated', {
			model: params.model || 'gpt-3.5-turbo',
			tokensUsed: completion.usage?.total_tokens || 0
		});

		return completion;
	} catch (error) {
		logError('Chat completion failed', { error: error.message });
		throw parseOpenAIError(error);
	}
}

/**
 * Generate embeddings using OpenAI
 * @param {string} apiKey - OpenAI API key
 * @param {string|Array} input - Text input(s) to embed
 * @param {Object} options - Embedding options
 * @returns {Promise<Array>} Array of embedding vectors
 */
export async function generateEmbeddings(apiKey, input, options = {}) {
	try {
		const client = createOpenAIClient(apiKey);
		
		const response = await client.embeddings.create({
			model: 'text-embedding-3-small',
			input,
			encoding_format: 'float',
			...options
		});

		logInfo('Embeddings generated', {
			model: options.model || 'text-embedding-3-small',
			inputCount: Array.isArray(input) ? input.length : 1,
			tokensUsed: response.usage?.total_tokens || 0
		});

		return response.data.map(item => item.embedding);
	} catch (error) {
		logError('Embedding generation failed', { error: error.message });
		throw parseOpenAIError(error);
	}
}