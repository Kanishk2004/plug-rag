import Conversation from '@/models/Conversation.js';
import Bot from '@/models/Bot.js';
import { apiKeyService } from './apiKeyService.js';
import { ragService } from './ragService.js';
import { logInfo, logError } from '../utils/logger.js';
import intentClassifier, { INTENT_TYPES } from './intentClassifier.js';
import { createOpenAIClient } from '../integrations/openai.js';
import faqService from './faqService.js';

/**
 * Custom error class for chat-related operations
 */
export class ChatError extends Error {
	constructor(message, code, statusCode = 400) {
		super(message);
		this.name = 'ChatError';
		this.code = code;
		this.statusCode = statusCode;
	}
}

/**
 * Chat Service
 * Handles chat conversations, message processing, and RAG integration
 */
class ChatService {
	constructor() {
		// API key cache: { botId: { config, timestamp } }
		this.apiKeyCache = new Map();
		this.CACHE_TTL = 10 * 60 * 1000; // 10 minutes in milliseconds
	}

	/**
	 * Clear API key cache for a specific bot or all bots
	 * @param {string} botId - Optional bot ID to clear specific cache
	 */
	clearAPIKeyCache(botId = null) {
		if (botId) {
			const cacheKey = botId.toString();
			this.apiKeyCache.delete(cacheKey);
			logInfo('Cleared API key cache for bot', { botId: cacheKey });
		} else {
			this.apiKeyCache.clear();
			logInfo('Cleared all API key cache');
		}
	}

	/**
	 * Get OpenAI configuration for a specific bot with caching
	 */
	async getOpenAIConfig(botId, userId) {
		// Convert to string for consistent cache key (ObjectId vs String)
		const cacheKey = botId.toString();

		// Check cache first
		const cached = this.apiKeyCache.get(cacheKey);
		if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
			logInfo('✅ Using cached API key', { botId: cacheKey });
			return cached.config;
		}

		logInfo('🔄 Fetching API key from database', { botId: cacheKey });
		try {
			const keyData = await apiKeyService.getApiKey(botId, userId);
			const config = {
				apiKey: keyData.apiKey,
				isCustom: keyData.isCustom,
				source: keyData.source,
				models: keyData.models || {
					chat: 'gpt-4.1-mini',
					embeddings: 'text-embedding-3-small',
				},
			};

			// Cache the config
			this.apiKeyCache.set(cacheKey, {
				config,
				timestamp: Date.now(),
			});

			logInfo('💾 Cached API key', { botId: cacheKey });

			return config;
		} catch (error) {
			// Fallback to global key if configured
			if (process.env.OPENAI_API_KEY) {
				const cacheKey = botId.toString();
				console.warn(
					`[ChatService] Using global API key fallback for bot ${cacheKey}: ${error.message}`
				);
				const config = {
					apiKey: process.env.OPENAI_API_KEY,
					isCustom: false,
					source: 'global_fallback',
					models: {
						chat: 'gpt-4',
						embeddings: 'text-embedding-3-small',
					},
				};

				// Cache fallback config
				this.apiKeyCache.set(cacheKey, {
					config,
					timestamp: Date.now(),
				});

				return config;
			}
			throw new Error(
				`No OpenAI API key available for bot ${botId}: ${error.message}`
			);
		}
	}

	/**
	 * Generate AI response using RAG
	 */
	async generateRAGResponse(
		bot,
		userQuery,
		conversationHistory = [],
		botInfo = {},
		apiKey
	) {
		try {
			// Delegate to ragService for RAG response generation
			const ragResponse = await ragService.generateResponse(
				bot,
				apiKey,
				userQuery,
				conversationHistory
			);

			// Return RAG response
			return {
				content: ragResponse.content,
				sources: ragResponse.sources,
				tokensUsed: ragResponse.tokensUsed,
				model: ragResponse.model,
				hasRelevantContext: ragResponse.hasRelevantContext,
				documentsFound: ragResponse.documentsFound,
				responseTime: ragResponse.responseTime,
			};
		} catch (error) {
			console.error('RAG generation error:', error);
			const fallbackResponse = `I apologize, but I encountered an error while processing your question. Please try again later.`;
			const fallbackTokens = Math.ceil(fallbackResponse.length * 0.75);

			return {
				content: fallbackResponse,
				sources: [],
				responseTime: 1000,
				tokensUsed: fallbackTokens,
				model: 'error-fallback',
				hasRelevantContext: false,
				error: error.message,
			};
		}
	}

	/**
	 * Send a message and get AI response
	 * @param {Object} bot - Bot document
	 * @param {string} userMessage - User's message
	 * @param {string} sessionId - Session identifier
	 * @param {Object} sessionMetadata - Optional session metadata (userFingerprint, domain, ipAddress, userAgent)
	 * @returns {Promise<Object>} AI response with metadata
	 */
	async sendMessage(bot, userMessage, sessionId, sessionMetadata = {}) {
		try {
			logInfo('Sending message to chat service', {
				botId: bot._id,
				sessionId,
				messageLength: userMessage?.length || 0,
				hasDomain: !!sessionMetadata.domain,
			});

			// Validate inputs
			if (!bot || !userMessage || !sessionId) {
				throw new ChatError(
					'Bot, message, and session ID are required',
					'MISSING_PARAMETERS',
					400
				);
			}

			// Get conversation history
			const conversation = await this.getOrCreateConversation(
				bot._id,
				sessionId
			);
			const conversationHistory = conversation.messages || [];

			// Step 1: Fetch API key once (with caching)
			const config = await this.getOpenAIConfig(bot._id, bot.ownerId);
			const { apiKey } = config;

			// Step 2: Classify intent to determine routing
			const intent = await intentClassifier.classify(userMessage, bot, apiKey);

			const userMessageObj = {
				role: 'user',
				content: userMessage,
				intentType: intent.type,
				intentConfidence: intent.confidence,
				timestamp: new Date(),
			};

			conversationHistory.push(userMessageObj);

			let aiResponse;

			// Step 3: Route based on intent
			if (intent.type === INTENT_TYPES.NEEDS_RAG) {
				// Full RAG pipeline
				aiResponse = await this.generateRAGResponse(
					bot,
					userMessage,
					conversationHistory,
					{
						name: bot.name,
						description: bot.description,
					},
					apiKey
				);
				aiResponse.responseType = 'rag';
			} else if (intent.type === INTENT_TYPES.GENERAL_CHAT) {
				// Simple LLM without retrieval
				aiResponse = await this.generateSimpleLLMResponse(
					bot,
					userMessage,
					conversationHistory,
					apiKey,
					config.models.chat || 'gpt-4.1-mini'
				);
			} else if (intent.type === INTENT_TYPES.SMALL_TALK) {
				// AI-powered small talk
				aiResponse = await this.generateSmallTalkResponse(
					bot,
					userMessage,
					conversationHistory,
					apiKey,
					config.models.chat || 'gpt-4.1-mini'
				);
			}

			// Create assistant message
			const assistantMessage = {
				role: 'assistant',
				content: aiResponse.content,
				timestamp: new Date(),
				sources: aiResponse.sources || [],
				responseTime: aiResponse.responseTime,
				tokensUsed: aiResponse.tokensUsed,
				model: aiResponse.model,
				hasRelevantContext: aiResponse.hasRelevantContext,
				responseType: aiResponse.responseType,
			};

			// Add assistant message to conversation
			conversationHistory.push(assistantMessage);

			// Save updated conversation with metadata
			await this.saveConversation(
				bot._id,
				sessionId,
				conversationHistory,
				sessionMetadata
			);

			// Determine if this is a new session (first message pair)
			const isNewSession = conversationHistory.length === 2;

			// Update bot analytics
			await this.updateBotAnalytics(bot._id, {
				messageCount: 1,
				tokensUsed: aiResponse.tokensUsed,
				isNewSession,
			});

			return {
				...assistantMessage,
			};
		} catch (error) {
			logError('Error sending message', error, {
				bot: bot._id,
				sessionId,
				// duration,
				errorType: error.constructor.name,
			});

			if (error instanceof ChatError) {
				throw error;
			}

			throw new ChatError(
				'Failed to process message',
				'MESSAGE_PROCESSING_FAILED',
				500
			);
		}
	}

	/**
	 * Get conversation history for a session
	 * @param {string} botId - The bot ID
	 * @param {string} sessionId - Session identifier
	 * @param {number} limit - Maximum number of messages to return
	 * @returns {Promise<Object>} Conversation history
	 */
	async getConversationHistory(botId, sessionId, limit = 50) {
		try {
			logInfo('Fetching conversation history', {
				botId,
				sessionId,
				limit,
			});

			// Validate inputs
			if (!botId || !sessionId) {
				throw new ChatError(
					'Bot ID and session ID are required',
					'MISSING_PARAMETERS',
					400
				);
			}

			// Get conversation
			const conversation = await Conversation.findOne({
				botId,
				sessionId,
			});

			if (!conversation) {
				return {
					messages: [],
					totalMessages: 0,
					sessionId,
					botId,
				};
			}

			// Limit messages if specified
			const messages = conversation.messages || [];
			const limitedMessages = limit ? messages.slice(-limit) : messages;

			// const duration = timer.stop();

			logInfo('Conversation history fetched successfully', {
				botId,
				sessionId,
				messageCount: limitedMessages.length,
				// duration,
			});

			return {
				messages: limitedMessages,
				totalMessages: messages.length,
				sessionId: conversation.sessionId,
				botId: conversation.botId,
				createdAt: conversation.createdAt,
				updatedAt: conversation.updatedAt,
			};
		} catch (error) {
			// const duration = timer.stop();

			logError('Error fetching conversation history', error, {
				botId,
				sessionId,
				// duration,
			});

			if (error instanceof ChatError) {
				throw error;
			}

			throw new ChatError(
				'Failed to fetch conversation history',
				'HISTORY_FETCH_FAILED',
				500
			);
		}
	}

	/**
	 * Clear conversation history for a session
	 * @param {string} botId - The bot ID
	 * @param {string} sessionId - Session identifier
	 * @returns {Promise<boolean>} Success status
	 */
	async clearConversationHistory(botId, sessionId) {
		try {
			logInfo('Clearing conversation history', {
				botId,
				sessionId,
			});

			// Validate inputs
			if (!botId || !sessionId) {
				throw new ChatError(
					'Bot ID and session ID are required',
					'MISSING_PARAMETERS',
					400
				);
			}

			// Delete conversation
			const result = await Conversation.deleteOne({
				botId,
				sessionId,
			});

			// const duration = timer.stop();

			const success = result.deletedCount > 0;

			logInfo('Conversation history cleared', {
				botId,
				sessionId,
				success,
				deletedCount: result.deletedCount,
				// duration,
			});

			return success;
		} catch (error) {
			// const duration = timer.stop();

			logError('Error clearing conversation history', error, {
				botId,
				sessionId,
				// duration,
			});

			if (error instanceof ChatError) {
				throw error;
			}

			throw new ChatError(
				'Failed to clear conversation history',
				'HISTORY_CLEAR_FAILED',
				500
			);
		}
	}

	/**
	 * Get or create a conversation for a session
	 * @param {string} botId - The bot ID
	 * @param {string} sessionId - Session identifier
	 * @returns {Promise<Object>} Conversation document
	 */
	async getOrCreateConversation(botId, sessionId) {
		try {
			let conversation = await Conversation.findOne({
				botId,
				sessionId,
			});

			if (!conversation) {
				conversation = new Conversation({
					botId,
					sessionId,
					messages: [],
				});
				await conversation.save();

				logInfo('New conversation created', {
					botId,
					sessionId,
				});
			}

			return conversation;
		} catch (error) {
			logError('Error getting or creating conversation', error, {
				botId,
				sessionId,
			});
			throw error;
		}
	}

	/**
	 * Save conversation with messages
	 * @param {string} botId - The bot ID
	 * @param {string} sessionId - Session identifier
	 * @param {Array} messages - Array of messages
	 * @returns {Promise<void>}
	 */
	/**
	 * Save conversation to database
	 * @param {string} botId - Bot ID
	 * @param {string} sessionId - Session ID
	 * @param {Array} messages - Message history
	 * @param {Object} sessionMetadata - Session metadata (userFingerprint, domain, ipAddress, userAgent)
	 */
	async saveConversation(botId, sessionId, messages, sessionMetadata = {}) {
		try {
			const updateData = {
				messages,
				totalMessages: messages.filter((m) => m.role === 'assistant').length,
				totalTokens: messages.reduce(
					(sum, m) => sum + (m.tokensUsed || m.tokens || 0),
					0
				),
				lastMessageAt: new Date(),
				updatedAt: new Date(),
			};

			// Add session metadata if this is a new conversation
			if (sessionMetadata.userFingerprint !== undefined) {
				updateData.userFingerprint = sessionMetadata.userFingerprint || '';
			}
			if (sessionMetadata.domain !== undefined) {
				updateData.domain = sessionMetadata.domain || 'unknown';
			}
			if (sessionMetadata.ipAddress !== undefined) {
				updateData.ipAddress = sessionMetadata.ipAddress || '';
			}
			if (sessionMetadata.userAgent !== undefined) {
				updateData.userAgent = sessionMetadata.userAgent || '';
			}

			await Conversation.findOneAndUpdate({ botId, sessionId }, updateData, {
				upsert: true,
				new: true,
			});

			logInfo('Conversation saved', {
				botId,
				sessionId,
				messageCount: messages.length,
			});
		} catch (error) {
			logError('Error saving conversation', error, {
				botId,
				sessionId,
				messageCount: messages?.length || 0,
			});
			throw error;
		}
	}

	/**
	 * Update bot analytics with chat data
	 * @param {string} botId - The bot ID
	 * @param {Object} analytics - Analytics data { messageCount, tokensUsed, isNewSession }
	 * @returns {Promise<void>}
	 */
	async updateBotAnalytics(botId, analytics) {
		try {
			const updateData = {
				'analytics.lastActiveAt': new Date(),
			};

			// Increment counters
			const incrementFields = {};

			if (analytics.messageCount) {
				incrementFields['analytics.totalMessages'] = analytics.messageCount;
			}

			if (analytics.tokensUsed) {
				incrementFields['analytics.totalTokensUsed'] = analytics.tokensUsed;
			}

			if (analytics.isNewSession) {
				incrementFields['analytics.totalSessions'] = 1;
			}

			if (Object.keys(incrementFields).length > 0) {
				updateData.$inc = incrementFields;
			}

			await Bot.findByIdAndUpdate(botId, updateData);

			logInfo('Bot analytics updated', {
				botId,
				analytics,
			});
		} catch (error) {
			// Don't throw - analytics shouldn't break main functionality
			logError('Error updating bot analytics', error, {
				botId,
				analytics,
			});
		}
	}

	/**
	 * Get chat statistics for a bot
	 * @param {string} botId - The bot ID
	 * @returns {Promise<Object>} Chat statistics
	 */
	async getChatStatistics(botId) {
		try {
			logInfo('Fetching chat statistics', { botId });

			// Get bot with analytics
			const bot = await Bot.findById(botId, 'analytics');
			if (!bot) {
				throw new ChatError('Bot not found', 'BOT_NOT_FOUND', 404);
			}

			// Count total conversations
			const conversationCount = await Conversation.countDocuments({ botId });

			// Get conversation statistics
			const conversationStats = await Conversation.aggregate([
				{ $match: { botId } },
				{
					$project: {
						messageCount: { $size: '$messages' },
						lastActivity: '$updatedAt',
					},
				},
				{
					$group: {
						_id: null,
						totalConversations: { $sum: 1 },
						totalMessages: { $sum: '$messageCount' },
						avgMessagesPerConversation: { $avg: '$messageCount' },
						lastActivity: { $max: '$lastActivity' },
					},
				},
			]);

			const stats = conversationStats[0] || {
				totalConversations: 0,
				totalMessages: 0,
				avgMessagesPerConversation: 0,
				lastActivity: null,
			};

			const result = {
				totalConversations: stats.totalConversations,
				totalMessages: stats.totalMessages,
				avgMessagesPerConversation: Math.round(
					stats.avgMessagesPerConversation || 0
				),
				lastActivity: stats.lastActivity,
				botAnalytics: bot.analytics || {},
			};

			logInfo('Chat statistics fetched successfully', {
				botId,
				statistics: result,
			});

			return result;
		} catch (error) {
			logError('Error fetching chat statistics', error, { botId });

			if (error instanceof ChatError) {
				throw error;
			}

			throw new ChatError(
				'Failed to fetch chat statistics',
				'STATISTICS_FETCH_FAILED',
				500
			);
		}
	}

	/**
	 * Generate simple LLM response without RAG retrieval
	 * Used for general chat that doesn't need document context
	 */
	async generateSimpleLLMResponse(
		bot,
		userMessage,
		conversationHistory,
		apiKey,
		model = 'gpt-4.1-mini'
	) {
		const startTime = Date.now();

		try {
			const client = createOpenAIClient(apiKey);

			// Get last 5 messages for context (not 10 like RAG)
			const recentMessages = conversationHistory.slice(-5);

			// Build FAQ context
			const faqContext = faqService.buildFAQContext(bot);

			let systemPrompt = `You are a helpful assistant for ${bot.name}.`;

			if (bot.description) {
				systemPrompt += `\n\nABOUT THIS ASSISTANT:\n${bot.description}`;
			}

			if (faqContext) {
				systemPrompt += `\n${faqContext}`;
			}

			systemPrompt += `\n\nIMPORTANT GUIDELINES:
- Answer questions based on the information provided above
- If a question matches a FAQ, use that guidance but respond naturally (don't just copy the FAQ answer)
- If asked about topics outside your knowledge, politely explain what you can help with
- Keep responses clear, concise, and friendly
- Be honest about limitations - don't make up information

Provide helpful, accurate responses within your knowledge scope.`;

			const messages = [
				{ role: 'system', content: systemPrompt },
				...recentMessages.map((msg) => ({
					role: msg.role,
					content: msg.content,
				})),
			];

			const response = await client.chat.completions.create({
				model,
				messages,
				temperature: 0.7,
				max_tokens: 200,
			});

			const content = response.choices[0].message.content;
			const tokensUsed = response.usage?.total_tokens || 0;
			const responseTime = Date.now() - startTime;

			logInfo('Simple LLM response generated', {
				botId: bot._id,
				tokensUsed,
				responseTime,
				model,
			});

			return {
				content,
				sources: [],
				responseTime,
				tokensUsed,
				model,
				hasRelevantContext: false,
				responseType: 'simple_llm',
			};
		} catch (error) {
			logError('Error generating simple LLM response', error);
			throw error;
		}
	}

	/**
	 * Generate small talk response using AI
	 * Used for greetings, thanks, goodbyes, and casual conversation
	 */
	async generateSmallTalkResponse(
		bot,
		userMessage,
		conversationHistory,
		apiKey,
		model = 'gpt-4.1-mini'
	) {
		const startTime = Date.now();

		try {
			const client = createOpenAIClient(apiKey);

			// Get last 3 messages for minimal context
			const recentMessages = conversationHistory.slice(-3);

			// Build FAQ context
			const faqContext = faqService.buildFAQContext(bot);

			let systemPrompt = `You are a friendly assistant for ${bot.name}.`;

			if (bot.description) {
				systemPrompt += `\n\nABOUT THIS ASSISTANT:\n${bot.description}`;
			}

			if (faqContext) {
				systemPrompt += `\n${faqContext}`;
			}

			systemPrompt += `\n\nYOUR ROLE:
- Respond warmly to greetings, thanks, and casual conversation
- Keep responses brief and friendly (1-2 sentences max)
- If appropriate, gently guide users toward what you can help with
- Use FAQs as guidance when relevant to the conversation

Be personable and welcoming while staying concise.`;

			const messages = [
				{ role: 'system', content: systemPrompt },
				...recentMessages.map((msg) => ({
					role: msg.role,
					content: msg.content,
				})),
			];

			const response = await client.chat.completions.create({
				model,
				messages,
				temperature: 0.8,
				max_tokens: 100,
			});

			const content = response.choices[0].message.content;
			const tokensUsed = response.usage?.total_tokens || 0;
			const responseTime = Date.now() - startTime;

			logInfo('Small talk response generated', {
				botId: bot._id,
				tokensUsed,
				responseTime,
				model,
			});

			return {
				content,
				sources: [],
				responseTime,
				tokensUsed,
				model,
				hasRelevantContext: false,
				responseType: 'small_talk',
			};
		} catch (error) {
			logError('Error generating small talk response', error);
			throw error;
		}
	}
}

// Export singleton instance
export const chatService = new ChatService();
export default chatService;
