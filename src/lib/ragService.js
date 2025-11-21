import { ChatOpenAI } from '@langchain/openai';
import { QdrantVectorStore } from '@langchain/qdrant';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { QdrantClient } from '@qdrant/js-client-rest';
import { getAccurateTokenCount } from './vectorStore.js';
import { apiKeyService } from './apiKeyService.js';
import Bot from '@/models/Bot.js';

/**
 * Enhanced RAG (Retrieval Augmented Generation) Service
 * Handles AI response generation using vector search and LLM with dynamic API key injection
 */
export class RAGService {
	constructor() {
		// Initialize Qdrant client (this doesn't require OpenAI API key)
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
	 * Get OpenAI configuration for a specific bot (API key and models)
	 * @param {string} botId - The bot ID
	 * @param {string} userId - The user ID (bot owner)
	 * @returns {Promise<Object>} OpenAI configuration
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
				console.warn(
					`[RAGService] Using global API key fallback for bot ${botId}: ${error.message}`
				);
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
			throw new Error(
				`No OpenAI API key available for bot ${botId}: ${error.message}`
			);
		}
	}

	/**
	 * Create LLM instance with bot-specific configuration
	 * @param {string} botId - The bot ID
	 * @param {string} userId - The user ID
	 * @returns {Promise<ChatOpenAI>} Configured LLM instance
	 */
	async createLLM(botId, userId) {
		const config = await this.getOpenAIConfig(botId, userId);

		return new ChatOpenAI({
			model: config.models.chat,
			temperature: 0.3,
			maxTokens: 1000,
			apiKey: config.apiKey, // Try this parameter name
			openAIApiKey: config.apiKey, // And also this one
		});
	}

	/**
	 * Create embeddings instance with bot-specific configuration
	 * @param {string} botId - The bot ID
	 * @param {string} userId - The user ID
	 * @returns {Promise<OpenAIEmbeddings>} Configured embeddings instance
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
	 * @param {string} botId - The bot ID (collection name)
	 * @returns {Promise<boolean>} Whether collection exists
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
	 * Get relevant documents from vector database with dynamic embeddings
	 * @param {string} botId - The bot ID (collection name)
	 * @param {string} userId - The user ID (for API key lookup)
	 * @param {string} query - User query
	 * @param {number} topK - Number of documents to retrieve
	 * @returns {Promise<Array>} Relevant document chunks
	 */
	async getRelevantDocuments(botId, userId, query, topK = 2) {
		try {
			// Check if collection exists
			const exists = await this.collectionExists(botId);
			if (!exists) {
				return [];
			}

			// Create embeddings instance with bot-specific API key
			const embeddings = await this.createEmbeddings(botId, userId);

			// Create vector store instance for this bot's collection
			const vectorStore = new QdrantVectorStore(embeddings, {
				client: this.qdrantClient,
				collectionName: botId,
			});

			// Perform similarity search
			const documents = await vectorStore.similaritySearch(query, topK);

			return documents;
		} catch (error) {
			console.error('Error retrieving relevant documents:', error);
			return [];
		}
	}

	/**
	 * Format conversation history for context
	 * @param {Array} messages - Recent conversation messages
	 * @param {number} maxMessages - Maximum number of messages to include
	 * @returns {string} Formatted chat history
	 */
	formatChatHistory(messages, maxMessages = 20) {
		if (!messages || messages.length === 0) {
			return 'No previous conversation.';
		}

		// Get recent messages (excluding the current user message)
		const recentMessages = messages
			.slice(-maxMessages - 1, -1) // Exclude the last message (current query)
			.map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
			.join('\n');

		return recentMessages || 'No previous conversation.';
	}

	/**
	 * Format retrieved documents as context
	 * @param {Array} documents - Retrieved document chunks
	 * @returns {string} Formatted context
	 */
	formatDocumentsAsContext(documents) {
		if (!documents || documents.length === 0) {
			return 'No relevant documents found in the knowledge base.';
		}

		return documents
			.map((doc, index) => {
				const metadata = doc.metadata || {};
				const fileName = metadata.fileName || metadata.source || 'Unknown file';
				const pageNumber = metadata.pageNumber
					? ` (Page ${metadata.pageNumber})`
					: '';

				return `[Source ${index + 1}: ${fileName}${pageNumber}]\n${
					doc.pageContent
				}`;
			})
			.join('\n\n');
	}

	/**
	 * Generate AI response using RAG with dynamic API key injection
	 * @param {string} botId - The bot ID
	 * @param {string} userQuery - User's question
	 * @param {Array} conversationHistory - Recent messages for context
	 * @param {Object} botInfo - Bot information (name, description)
	 * @returns {Promise<Object>} AI response with metadata
	 */
	async generateResponse(
		botId,
		userQuery,
		conversationHistory = [],
		botInfo = {}
	) {
		try {
			const startTime = Date.now();

			// Get bot owner for API key lookup
			const bot = await Bot.findById(botId, 'ownerId');
			if (!bot) {
				throw new Error('Bot not found');
			}

			// Step 1: Retrieve relevant documents with dynamic embeddings
			const relevantDocs = await this.getRelevantDocuments(
				botId,
				bot.ownerId,
				userQuery,
				4
			);

			// Step 2: Format context and chat history
			const context = this.formatDocumentsAsContext(relevantDocs);
			const chatHistory = this.formatChatHistory(conversationHistory, 20);

			// Step 3: Check if we have relevant context
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

			// Step 4: Create dynamic LLM instance with bot-specific API key
			const llm = await this.createLLM(botId, bot.ownerId);

			// Step 5: Create the RAG chain with dynamic LLM
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

			// Step 6: Generate response
			const response = await ragChain.invoke({ question: userQuery });

			// Step 6.1: Remove source citations from the response text
			const cleanResponse = response
				.replace(/\s*\[Source \d+:[^\]]+\]\s*/g, '')
				.trim();

			// Step 7: Extract source information
			const sources = relevantDocs.map((doc) => ({
				fileName:
					doc.metadata?.fileName || doc.metadata?.source || 'Unknown file',
				pageNumber: doc.metadata?.pageNumber,
				chunkIndex: doc.metadata?.chunkIndex,
				score: doc.metadata?.score,
			}));

			// Step 8: Calculate response time and prepare usage tracking
			const responseTime = Date.now() - startTime;
			
			// Step 9: Estimate token usage (rough estimation)
			const estimatedTokens = Math.ceil(cleanResponse.length * 0.75); // Rough estimation: ~0.75 tokens per character

			// Step 10: Track usage for cost management (async, don't block response)
			this.trackUsage(botId, bot.ownerId, {
				chatTokens: estimatedTokens,
				totalTokens: estimatedTokens,
			}).catch((error) => {
				console.warn('Failed to track usage:', error);
			});

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

			// Return error fallback
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
	 * Track usage for a bot's API key
	 * @param {string} botId - The bot ID
	 * @param {string} userId - The user ID
	 * @param {Object} usage - Usage data
	 * @returns {Promise<void>}
	 */
	async trackUsage(botId, userId, usage) {
		try {
			await apiKeyService.trackUsage(botId, userId, usage);
		} catch (error) {
			console.error('Error tracking usage:', error);
			// Don't throw - usage tracking shouldn't break main functionality
		}
	}

	/**
	 * Generate fallback response when no relevant documents found
	 * @param {string} botName - Name of the bot
	 * @returns {string} Fallback response
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
	 * Get available topics/files in the knowledge base
	 * @param {string} botId - The bot ID
	 * @returns {Promise<Array>} Available files and their metadata
	 */
	async getAvailableTopics(botId) {
		try {
			// Check if collection exists
			const exists = await this.collectionExists(botId);
			if (!exists) {
				return [];
			}

			// Get collection info to understand what files are available
			const collectionInfo = await this.qdrantClient.getCollection(botId);

			// For now, return basic collection info
			// In the future, we could enhance this to return file-specific topics
			return {
				totalDocuments: collectionInfo.points_count,
				collectionName: botId,
				status: collectionInfo.status,
			};
		} catch (error) {
			console.error('Error getting available topics:', error);
			return [];
		}
	}
}

// Export singleton instance
export const ragService = new RAGService();
export default ragService;
