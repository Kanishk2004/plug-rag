import { encrypt, decrypt } from './encryption.js';
import { validateOpenAIKey } from './openaiValidator.js';
import Bot from '@/models/Bot.js';
import connectDB from '@/lib/mongo.js';

/**
 * API Key Management Service
 * Handles storage, retrieval, and validation of custom OpenAI API keys per bot
 */
export class ApiKeyService {
	/**
	 * Store encrypted API key for a bot after validation
	 * @param {string} botId - The bot ID
	 * @param {string} apiKey - The OpenAI API key to store
	 * @param {string} userId - The user ID (for ownership validation)
	 * @param {Object} options - Additional options (models, limits, etc.)
	 * @returns {Promise<Object>} Result of the storage operation
	 */
	async storeApiKey(botId, apiKey, userId, options = {}) {
		try {
			await connectDB();

			// Step 1: Validate the API key first
			console.log(`Validating API key for bot ${botId}...`);
			const validation = await validateOpenAIKey(apiKey);

			if (!validation.isValid) {
				throw new Error(`Invalid API key: ${validation.error}`);
			}

			// Step 2: Encrypt the API key
			const encryptedKey = encrypt(apiKey);

			// Step 3: Prepare update data
			const updateData = {
				'apiConfiguration.openaiConfig.apiKeyEncrypted': encryptedKey,
				'apiConfiguration.openaiConfig.keyStatus': 'valid',
				'apiConfiguration.openaiConfig.lastValidated': new Date(),
			};

			// Set model preferences if provided
			if (options.models) {
				if (options.models.chat) {
					updateData['apiConfiguration.openaiConfig.models.chat'] =
						options.models.chat;
				}
				if (options.models.embeddings) {
					updateData['apiConfiguration.openaiConfig.models.embeddings'] =
						options.models.embeddings;
				}
			}

			// Set fallback preference if provided
			if (options.fallbackToGlobal !== undefined) {
				updateData['apiConfiguration.fallbackToGlobal'] =
					options.fallbackToGlobal;
			}

			// Set cost tracking options if provided
			if (options.costTracking) {
				if (options.costTracking.enabled !== undefined) {
					updateData['apiConfiguration.openaiConfig.costTracking.enabled'] =
						options.costTracking.enabled;
				}
				if (options.costTracking.monthlyLimit !== undefined) {
					updateData[
						'apiConfiguration.openaiConfig.costTracking.monthlyLimit'
					] = options.costTracking.monthlyLimit;
				}
			}

			// Step 4: Update bot configuration
			const bot = await Bot.findOneAndUpdate(
				{ _id: botId, ownerId: userId },
				{ $set: updateData },
				{ new: true, runValidators: true }
			);

			if (!bot) {
				throw new Error('Bot not found or unauthorized');
			}

			console.log(`API key stored successfully for bot ${botId}`);

			return {
				success: true,
				status: 'valid',
				supportedModels: validation.supportedModels,
				capabilities: validation.capabilities,
				validationCosts: validation.validationCosts,
			};
		} catch (error) {
			console.error(`Error storing API key for bot ${botId}:`, error);
			throw error;
		}
	}

	/**
	 * Retrieve and decrypt API key for a bot
	 * @param {string} botId - The bot ID
	 * @param {string} userId - The user ID (for ownership validation)
	 * @returns {Promise<Object>} API key and configuration data
	 */
	async getApiKey(botId, userId) {
		try {
			await connectDB();

			console.log(
				`[ApiKeyService] Getting API key for bot ${botId}, user ${userId}`
			);

			// Query bot with API configuration (including encrypted key)
			const bot = await Bot.findOne({ _id: botId, ownerId: userId }).select(
				'+apiConfiguration.openaiConfig.apiKeyEncrypted'
			);

			if (!bot) {
				console.log(
					`[ApiKeyService] Bot not found or unauthorized for bot ${botId}, user ${userId}`
				);
				throw new Error('Bot not found or unauthorized');
			}

			const apiConfig = bot.apiConfiguration?.openaiConfig;
			const fallbackEnabled = bot.apiConfiguration?.fallbackToGlobal;

			console.log(
				`[ApiKeyService] Bot found. Has custom key: ${!!apiConfig?.apiKeyEncrypted}, Fallback enabled: ${fallbackEnabled}`
			);

			// Check if bot has custom API key
			if (!apiConfig?.apiKeyEncrypted) {
				console.log(`[ApiKeyService] No custom key found for bot ${botId}`);
				// No custom key - check if fallback is enabled
				if (fallbackEnabled && process.env.OPENAI_API_KEY) {
					console.log(`[ApiKeyService] Using global fallback key`);
					return {
						apiKey: process.env.OPENAI_API_KEY,
						source: 'global',
						isCustom: false,
						models: {
							chat: 'gpt-4',
							embeddings: 'text-embedding-3-small',
						},
					};
				}
				console.log(
					`[ApiKeyService] No custom key and no global fallback available`
				);
				throw new Error('No API key configured for this bot');
			}

			// Bot has custom API key - always use it regardless of fallback setting
			console.log(`[ApiKeyService] Custom API key found, decrypting...`);
			const decryptedKey = decrypt(apiConfig.apiKeyEncrypted).trim(); // Trim whitespace
			console.log(
				`[ApiKeyService] Custom API key decrypted successfully. Length: ${
					decryptedKey ? decryptedKey.length : 'undefined'
				}, starts with sk-: ${
					decryptedKey ? decryptedKey.startsWith('sk-') : 'undefined'
				}`
			);

			return {
				apiKey: decryptedKey,
				source: 'custom',
				isCustom: true,
				models: apiConfig.models || {
					chat: 'gpt-4',
					embeddings: 'text-embedding-3-small',
				},
				keyStatus: apiConfig.keyStatus,
				lastValidated: apiConfig.lastValidated,
				usage: apiConfig.usage,
			};
		} catch (error) {
			console.error(
				`[ApiKeyService] Error retrieving API key for bot ${botId}:`,
				error
			);
			throw error;
		}
	}

	/**
	 * Remove API key from a bot (revert to fallback)
	 * @param {string} botId - The bot ID
	 * @param {string} userId - The user ID (for ownership validation)
	 * @returns {Promise<void>}
	 */
	async removeApiKey(botId, userId) {
		try {
			await connectDB();

			const result = await Bot.findOneAndUpdate(
				{ _id: botId, ownerId: userId },
				{
					$unset: {
						'apiConfiguration.openaiConfig.apiKeyEncrypted': 1,
					},
					$set: {
						'apiConfiguration.openaiConfig.keyStatus': 'none',
						'apiConfiguration.openaiConfig.lastValidated': null,
					},
				}
			);

			if (!result) {
				throw new Error('Bot not found or unauthorized');
			}

			console.log(`API key removed for bot ${botId}`);
		} catch (error) {
			console.error(`Error removing API key for bot ${botId}:`, error);
			throw error;
		}
	}

	/**
	 * Validate existing stored API key for a bot
	 * @param {string} botId - The bot ID
	 * @param {string} userId - The user ID
	 * @returns {Promise<Object>} Validation result
	 */
	async validateStoredKey(botId, userId) {
		try {
			const keyData = await this.getApiKey(botId, userId);

			if (!keyData.isCustom) {
				return {
					isValid: true,
					source: 'global',
					message: 'Using global API key',
				};
			}

			// Validate the custom key
			const validation = await validateOpenAIKey(keyData.apiKey);

			// Update the validation status in database
			await Bot.findOneAndUpdate(
				{ _id: botId, ownerId: userId },
				{
					'apiConfiguration.openaiConfig.keyStatus': validation.isValid
						? 'valid'
						: 'invalid',
					'apiConfiguration.openaiConfig.lastValidated': new Date(),
				}
			);

			return validation;
		} catch (error) {
			console.error(`Error validating stored key for bot ${botId}:`, error);
			return {
				isValid: false,
				error: error.message,
			};
		}
	}

	/**
	 * Get API key configuration status for a bot
	 * @param {string} botId - The bot ID
	 * @param {string} userId - The user ID
	 * @returns {Promise<Object>} Configuration status
	 */
	async getKeyStatus(botId, userId) {
		try {
			await connectDB();

			const bot = await Bot.findOne(
				{ _id: botId, ownerId: userId },
				'apiConfiguration'
			);

			if (!bot) {
				throw new Error('Bot not found or unauthorized');
			}

			const config = bot.apiConfiguration?.openaiConfig;

			return {
				hasCustomKey: !!config?.apiKeyEncrypted,
				keyStatus: config?.keyStatus || 'none',
				lastValidated: config?.lastValidated,
				models: config?.models,
				usage: config?.usage,
				costTracking: config?.costTracking,
				fallbackToGlobal: bot.apiConfiguration?.fallbackToGlobal,
			};
		} catch (error) {
			console.error(`Error getting key status for bot ${botId}:`, error);
			throw error;
		}
	}

	/**
	 * Track usage for a bot's API key
	 * @param {string} botId - The bot ID
	 * @param {string} userId - The user ID
	 * @param {Object} usage - Usage data {chatTokens, embedTokens, totalTokens}
	 * @returns {Promise<void>}
	 */
	async trackUsage(botId, userId, usage) {
		try {
			if (!usage || !usage.totalTokens) {
				return; // No usage to track
			}

			const updateData = {
				$inc: {},
			};

			if (usage.totalTokens) {
				updateData.$inc['apiConfiguration.openaiConfig.usage.totalTokens'] =
					usage.totalTokens;
			}
			if (usage.chatTokens) {
				updateData.$inc['apiConfiguration.openaiConfig.usage.chatTokens'] =
					usage.chatTokens;
			}
			if (usage.embedTokens) {
				updateData.$inc['apiConfiguration.openaiConfig.usage.embedTokens'] =
					usage.embedTokens;
			}

			await Bot.findOneAndUpdate({ _id: botId, ownerId: userId }, updateData);
		} catch (error) {
			console.error(`Error tracking usage for bot ${botId}:`, error);
			// Don't throw - usage tracking shouldn't break main functionality
		}
	}
}

// Export singleton instance
export const apiKeyService = new ApiKeyService();
export default apiKeyService;
