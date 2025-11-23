import Conversation from '@/models/Conversation.js';
import Bot from '@/models/Bot.js';
import { QdrantVectorStore } from '@langchain/qdrant';
import { OpenAIEmbeddings } from '@langchain/openai';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { QdrantClient } from '@qdrant/js-client-rest';
import { apiKeyService } from './apiKeyService.js';
import { logInfo, logError } from '../utils/logger.js';
import { createPerformanceTimer } from '../utils/performance.js';

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
		// Initialize Qdrant client
		this.qdrantClient = new QdrantClient({
			host: process.env.QDRANT_HOST || 'localhost',
			port: process.env.QDRANT_PORT || 6333,
			apiKey: process.env.QDRANT_API_KEY,
		});

		// System prompt template for RAG
		this.systemPromptTemplate = PromptTemplate.fromTemplate(`
You are an AI assistant that answers questions based strictly on the provided context from uploaded documents.

IMPORTANT RULES:
1. ONLY answer questions using information from the provided context
2. If the context doesn't contain relevant information, politely decline and suggest topics you can help with
3. Be concise but comprehensive in your answers
4. Always cite information from the context when possible
5. Maintain a helpful and professional tone
6. If asked about topics outside your knowledge base, explain that you can only help with information from the uploaded documents

CONTEXT FROM DOCUMENTS:
{context}

CONVERSATION HISTORY:
{chat_history}

HUMAN QUESTION: {question}

ASSISTANT RESPONSE:`);
	}

	/**
	 * Get OpenAI configuration for a specific bot
	 */
	async getOpenAIConfig(botId, userId) {
		try {
			const keyData = await apiKeyService.getApiKey(botId, userId);
			return {
				apiKey: keyData.apiKey,
				isCustom: keyData.isCustom,
				source: keyData.source,
				models: keyData.models || {
					chat: 'gpt-4',
					embeddings: 'text-embedding-3-small',
				},
			};
		} catch (error) {
			// Fallback to global key if configured
			if (process.env.OPENAI_API_KEY) {
				console.warn(`[ChatService] Using global API key fallback for bot ${botId}: ${error.message}`);
				return {
					apiKey: process.env.OPENAI_API_KEY,
					isCustom: false,
					source: 'global_fallback',
					models: {
						chat: 'gpt-4',
						embeddings: 'text-embedding-3-small',
					},
				};
			}
			throw new Error(`No OpenAI API key available for bot ${botId}: ${error.message}`);
		}
	}

	/**
	 * Create LLM instance with bot-specific configuration
	 */
	async createLLM(botId, userId) {
		const config = await this.getOpenAIConfig(botId, userId);
		return new ChatOpenAI({
			model: config.models.chat,
			temperature: 0.3,
			maxTokens: 1000,
			openAIApiKey: config.apiKey,
		});
	}

	/**
	 * Create embeddings instance with bot-specific configuration
	 */
	async createEmbeddings(botId, userId) {
		const config = await this.getOpenAIConfig(botId, userId);
		return new OpenAIEmbeddings({
			model: config.models.embeddings,
			openAIApiKey: config.apiKey,
		});
	}

	/**
	 * Check if a collection exists for the given botId
	 */
	async collectionExists(botId) {
		try {
			const collections = await this.qdrantClient.getCollections();
			return collections.collections.some((col) => col.name === botId);
		} catch (error) {
			console.error('Error checking collection existence:', error);
			return false;
		}
	}

	/**
	 * Get relevant documents from vector database
	 */
	async getRelevantDocuments(botId, userId, query, topK = 4) {
		try {
			const exists = await this.collectionExists(botId);
			if (!exists) {
				return [];
			}

			const embeddings = await this.createEmbeddings(botId, userId);
			const vectorStore = new QdrantVectorStore(embeddings, {
				client: this.qdrantClient,
				collectionName: botId,
			});

			const documents = await vectorStore.similaritySearch(query, topK);
			return documents;
		} catch (error) {
			console.error('Error retrieving relevant documents:', error);
			return [];
		}
	}

	/**
	 * Format conversation history for context
	 */
	formatChatHistory(messages, maxMessages = 20) {
		if (!messages || messages.length === 0) {
			return 'No previous conversation.';
		}

		const recentMessages = messages
			.slice(-maxMessages - 1, -1)
			.map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
			.join('\n');

		return recentMessages || 'No previous conversation.';
	}

	/**
	 * Format retrieved documents as context
	 */
	formatDocumentsAsContext(documents) {
		if (!documents || documents.length === 0) {
			return 'No relevant documents found in the knowledge base.';
		}

		return documents
			.map((doc, index) => {
				const metadata = doc.metadata || {};
				const fileName = metadata.fileName || metadata.source || 'Unknown file';
				const pageNumber = metadata.pageNumber ? ` (Page ${metadata.pageNumber})` : '';
				return `[Source ${index + 1}: ${fileName}${pageNumber}]\n${doc.pageContent}`;
			})
			.join('\n\n');
	}

	/**
	 * Generate fallback response when no relevant documents found
	 */
	generateFallbackResponse(botName = 'Assistant') {
		const suggestions = [
			'Ask about the content in the uploaded documents',
			'Request summaries of specific topics',
			'Ask for details about processes or procedures mentioned in the files',
			'Inquire about data or information contained in the knowledge base',
		];

		return `I'm sorry, but I couldn't find relevant information in my knowledge base to answer your question. 

I can only provide answers based on the documents that have been uploaded to me. Here are some ways I can help:

${suggestions.map((suggestion) => `• ${suggestion}`).join('\n')}

Please feel free to ask me about any topics covered in the uploaded documents!`;
	}

	/**
	 * Generate AI response using RAG
	 */
	async generateRAGResponse(botId, userQuery, conversationHistory = [], botInfo = {}) {
		try {
			const startTime = Date.now();
			const bot = await Bot.findById(botId, 'ownerId');
			if (!bot) {
				throw new Error('Bot not found');
			}

			// Retrieve relevant documents
			const relevantDocs = await this.getRelevantDocuments(botId, bot.ownerId, userQuery, 4);

			// Format context and chat history
			const context = this.formatDocumentsAsContext(relevantDocs);
			const chatHistory = this.formatChatHistory(conversationHistory, 20);

			// Check if we have relevant context
			if (relevantDocs.length === 0) {
				const fallbackResponse = this.generateFallbackResponse(botInfo.name);
				const fallbackTokens = Math.ceil(fallbackResponse.length * 0.75);
				return {
					content: fallbackResponse,
					sources: [],
					responseTime: Date.now() - startTime,
					tokensUsed: fallbackTokens,
					model: 'fallback',
					hasRelevantContext: false,
				};
			}

			// Create dynamic LLM instance
			const llm = await this.createLLM(botId, bot.ownerId);

			// Create the RAG chain
			const ragChain = RunnableSequence.from([
				{
					context: () => context,
					chat_history: () => chatHistory,
					question: (input) => input.question,
				},
				this.systemPromptTemplate,
				llm,
				new StringOutputParser(),
			]);

			// Generate response
			const response = await ragChain.invoke({ question: userQuery });

			// Clean response
			const cleanResponse = response.replace(/\s*\[Source \d+:[^\]]+\]\s*/g, '').trim();

			// Extract source information
			const sources = relevantDocs.map((doc) => ({
				fileName: doc.metadata?.fileName || doc.metadata?.source || 'Unknown file',
				pageNumber: doc.metadata?.pageNumber,
				chunkIndex: doc.metadata?.chunkIndex,
				score: doc.metadata?.score,
			}));

			const responseTime = Date.now() - startTime;
			const estimatedTokens = Math.ceil(cleanResponse.length * 0.75);

			return {
				content: cleanResponse,
				sources: sources,
				responseTime: responseTime,
				tokensUsed: estimatedTokens,
				model: llm.modelName,
				hasRelevantContext: true,
				apiSource: (await this.getOpenAIConfig(botId, bot.ownerId)).source,
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
	 * @param {string} botId - The bot ID
	 * @param {string} userMessage - User's message
	 * @param {string} sessionId - Session identifier
	 * @returns {Promise<Object>} AI response with metadata
	 */
	async sendMessage(botId, userMessage, sessionId) {
		const timer = createPerformanceTimer();
		
		try {
			logInfo('Sending message to chat service', {
				botId,
				sessionId,
				messageLength: userMessage?.length || 0
			});

			// Validate inputs
			if (!botId || !userMessage || !sessionId) {
				throw new ChatError(
					'Bot ID, message, and session ID are required',
					'MISSING_PARAMETERS',
					400
				);
			}

			// Verify bot exists
			const bot = await Bot.findById(botId);
			if (!bot) {
				throw new ChatError(
					'Bot not found',
					'BOT_NOT_FOUND',
					404
				);
			}

			// Get conversation history
			const conversation = await this.getOrCreateConversation(botId, sessionId);
			const conversationHistory = conversation.messages || [];

			// Add user message to conversation
			const userMessageObj = {
				role: 'user',
				content: userMessage,
				timestamp: new Date()
			};
			
			conversationHistory.push(userMessageObj);

			// Generate AI response using internal RAG
			const ragResponse = await this.generateRAGResponse(
				botId,
				userMessage,
				conversationHistory,
				{
					name: bot.name,
					description: bot.description
				}
			);

			// Create assistant message
			const assistantMessage = {
				role: 'assistant',
				content: ragResponse.content,
				timestamp: new Date(),
				metadata: {
					sources: ragResponse.sources,
					responseTime: ragResponse.responseTime,
					tokensUsed: ragResponse.tokensUsed,
					model: ragResponse.model,
					hasRelevantContext: ragResponse.hasRelevantContext,
					apiSource: ragResponse.apiSource
				}
			};

			// Add assistant message to conversation
			conversationHistory.push(assistantMessage);

			// Save updated conversation
			await this.saveConversation(botId, sessionId, conversationHistory);

			// Update bot analytics
			await this.updateBotAnalytics(botId, {
				messageCount: 1,
				tokensUsed: ragResponse.tokensUsed,
				hasRelevantContext: ragResponse.hasRelevantContext
			});

			const duration = timer.stop();
			
			logInfo('Message processed successfully', {
				botId,
				sessionId,
				duration,
				responseLength: ragResponse.content?.length || 0,
				tokensUsed: ragResponse.tokensUsed,
				hasRelevantContext: ragResponse.hasRelevantContext
			});

			return {
				message: ragResponse.content,
				sources: ragResponse.sources,
				metadata: {
					messageId: assistantMessage.timestamp.toISOString(),
					responseTime: ragResponse.responseTime,
					tokensUsed: ragResponse.tokensUsed,
					model: ragResponse.model,
					hasRelevantContext: ragResponse.hasRelevantContext,
					apiSource: ragResponse.apiSource,
					processingTime: duration
				}
			};

		} catch (error) {
			const duration = timer.stop();
			
			logError('Error sending message', error, {
				botId,
				sessionId,
				duration,
				errorType: error.constructor.name
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
		const timer = createPerformanceTimer();

		try {
			logInfo('Fetching conversation history', {
				botId,
				sessionId,
				limit
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
				sessionId
			});

			if (!conversation) {
				return {
					messages: [],
					totalMessages: 0,
					sessionId,
					botId
				};
			}

			// Limit messages if specified
			const messages = conversation.messages || [];
			const limitedMessages = limit ? messages.slice(-limit) : messages;

			const duration = timer.stop();

			logInfo('Conversation history fetched successfully', {
				botId,
				sessionId,
				messageCount: limitedMessages.length,
				duration
			});

			return {
				messages: limitedMessages,
				totalMessages: messages.length,
				sessionId: conversation.sessionId,
				botId: conversation.botId,
				createdAt: conversation.createdAt,
				updatedAt: conversation.updatedAt
			};

		} catch (error) {
			const duration = timer.stop();
			
			logError('Error fetching conversation history', error, {
				botId,
				sessionId,
				duration
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
		const timer = createPerformanceTimer();

		try {
			logInfo('Clearing conversation history', {
				botId,
				sessionId
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
				sessionId
			});

			const duration = timer.stop();

			const success = result.deletedCount > 0;

			logInfo('Conversation history cleared', {
				botId,
				sessionId,
				success,
				deletedCount: result.deletedCount,
				duration
			});

			return success;

		} catch (error) {
			const duration = timer.stop();
			
			logError('Error clearing conversation history', error, {
				botId,
				sessionId,
				duration
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
				sessionId
			});

			if (!conversation) {
				conversation = new Conversation({
					botId,
					sessionId,
					messages: []
				});
				await conversation.save();
				
				logInfo('New conversation created', {
					botId,
					sessionId
				});
			}

			return conversation;

		} catch (error) {
			logError('Error getting or creating conversation', error, {
				botId,
				sessionId
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
	async saveConversation(botId, sessionId, messages) {
		try {
			await Conversation.findOneAndUpdate(
				{ botId, sessionId },
				{ 
					messages,
					updatedAt: new Date()
				},
				{ 
					upsert: true,
					new: true
				}
			);

			logInfo('Conversation saved', {
				botId,
				sessionId,
				messageCount: messages.length
			});

		} catch (error) {
			logError('Error saving conversation', error, {
				botId,
				sessionId,
				messageCount: messages?.length || 0
			});
			throw error;
		}
	}

	/**
	 * Update bot analytics with chat data
	 * @param {string} botId - The bot ID
	 * @param {Object} analytics - Analytics data
	 * @returns {Promise<void>}
	 */
	async updateBotAnalytics(botId, analytics) {
		try {
			const updateData = {};
			
			if (analytics.messageCount) {
				updateData.$inc = {
					'analytics.totalMessages': analytics.messageCount,
					'analytics.totalTokensUsed': analytics.tokensUsed || 0
				};
			}

			if (analytics.hasRelevantContext !== undefined) {
				updateData.$inc = updateData.$inc || {};
				updateData.$inc['analytics.relevantResponses'] = 
					analytics.hasRelevantContext ? 1 : 0;
				updateData.$inc['analytics.fallbackResponses'] = 
					analytics.hasRelevantContext ? 0 : 1;
			}

			updateData.updatedAt = new Date();

			await Bot.findByIdAndUpdate(botId, updateData);

			logInfo('Bot analytics updated', {
				botId,
				analytics
			});

		} catch (error) {
			// Don't throw - analytics shouldn't break main functionality
			logError('Error updating bot analytics', error, {
				botId,
				analytics
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
				throw new ChatError(
					'Bot not found',
					'BOT_NOT_FOUND',
					404
				);
			}

			// Count total conversations
			const conversationCount = await Conversation.countDocuments({ botId });

			// Get conversation statistics
			const conversationStats = await Conversation.aggregate([
				{ $match: { botId } },
				{
					$project: {
						messageCount: { $size: '$messages' },
						lastActivity: '$updatedAt'
					}
				},
				{
					$group: {
						_id: null,
						totalConversations: { $sum: 1 },
						totalMessages: { $sum: '$messageCount' },
						avgMessagesPerConversation: { $avg: '$messageCount' },
						lastActivity: { $max: '$lastActivity' }
					}
				}
			]);

			const stats = conversationStats[0] || {
				totalConversations: 0,
				totalMessages: 0,
				avgMessagesPerConversation: 0,
				lastActivity: null
			};

			const result = {
				totalConversations: stats.totalConversations,
				totalMessages: stats.totalMessages,
				avgMessagesPerConversation: Math.round(stats.avgMessagesPerConversation || 0),
				lastActivity: stats.lastActivity,
				botAnalytics: bot.analytics || {}
			};

			logInfo('Chat statistics fetched successfully', {
				botId,
				statistics: result
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
	 * Get available topics in the bot's knowledge base
	 * @param {string} botId - The bot ID
	 * @returns {Promise<Object>} Available topics and knowledge base info
	 */
	async getAvailableTopics(botId) {
		try {
			logInfo('Fetching available topics', { botId });

			// Validate bot exists
			const bot = await Bot.findById(botId);
			if (!bot) {
				throw new ChatError(
					'Bot not found',
					'BOT_NOT_FOUND',
					404
				);
			}

			// Get topics from RAG service
			const topics = await ragService.getAvailableTopics(botId);

			logInfo('Available topics fetched successfully', {
				botId,
				topicCount: Array.isArray(topics) ? topics.length : 0
			});

			return {
				botId,
				botName: bot.name,
				topics,
				hasKnowledgeBase: Array.isArray(topics) ? topics.length > 0 : !!topics.totalDocuments
			};

		} catch (error) {
			logError('Error fetching available topics', error, { botId });

			if (error instanceof ChatError) {
				throw error;
			}

			throw new ChatError(
				'Failed to fetch available topics',
				'TOPICS_FETCH_FAILED',
				500
			);
		}
	}
}

// Export singleton instance
export const chatService = new ChatService();
export default chatService;
