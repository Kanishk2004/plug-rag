import { ChatOpenAI } from '@langchain/openai';
import { QdrantVectorStore } from '@langchain/qdrant';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { QdrantClient } from '@qdrant/js-client-rest';
import { getAccurateTokenCount } from './vectorStore.js';

/**
 * RAG (Retrieval Augmented Generation) Service
 * Handles AI response generation using vector search and LLM
 */
export class RAGService {
	constructor() {
		// Initialize OpenAI LLM
		this.llm = new ChatOpenAI({
			modelName: 'gpt-4',
			temperature: 0.3, // Low temperature for more focused responses
			maxTokens: 1000, // Reasonable limit for chat responses
			openAIApiKey: process.env.OPENAI_API_KEY,
		});

		// Initialize embeddings (same as used for indexing)
		this.embeddings = new OpenAIEmbeddings({
			modelName: 'text-embedding-3-small',
			openAIApiKey: process.env.OPENAI_API_KEY,
		});

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
	 * Get relevant documents from vector database
	 * @param {string} botId - The bot ID (collection name)
	 * @param {string} query - User query
	 * @param {number} topK - Number of documents to retrieve
	 * @returns {Promise<Array>} Relevant document chunks
	 */
	async getRelevantDocuments(botId, query, topK = 4) {
		try {
			// Check if collection exists
			const exists = await this.collectionExists(botId);
			if (!exists) {
				console.log(`Collection ${botId} does not exist`);
				return [];
			}

			// Create vector store instance for this bot's collection
			const vectorStore = new QdrantVectorStore(this.embeddings, {
				client: this.qdrantClient,
				collectionName: botId,
			});

			// Perform similarity search
			const documents = await vectorStore.similaritySearch(query, topK);

			// Log search results for debugging
			console.log(
				`Found ${documents.length} relevant documents for query: "${query}"`
			);

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
	 * Generate AI response using RAG
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

			// Step 1: Retrieve relevant documents
			const relevantDocs = await this.getRelevantDocuments(botId, userQuery, 4);

			// Step 2: Format context and chat history
			const context = this.formatDocumentsAsContext(relevantDocs);
			const chatHistory = this.formatChatHistory(conversationHistory, 20);

			// Step 3: Check if we have relevant context
			if (relevantDocs.length === 0) {
				const fallbackResponse = this.generateFallbackResponse(botInfo.name);
				return {
					content: fallbackResponse,
					sources: [],
					//   tokensUsed: await getAccurateTokenCount(fallbackResponse),
					responseTime: Date.now() - startTime,
					model: 'gpt-4',
					hasRelevantContext: false,
				};
			}

			// Step 4: Create the RAG chain
			const ragChain = RunnableSequence.from([
				{
					context: () => context,
					chat_history: () => chatHistory,
					question: (input) => input.question,
				},
				this.systemPromptTemplate,
				this.llm,
				new StringOutputParser(),
			]);

			// Step 5: Generate response
			const response = await ragChain.invoke({ question: userQuery });

			// Step 6: Extract source information
			const sources = relevantDocs.map((doc) => ({
				fileName:
					doc.metadata?.fileName || doc.metadata?.source || 'Unknown file',
				pageNumber: doc.metadata?.pageNumber,
				chunkIndex: doc.metadata?.chunkIndex,
				score: doc.metadata?.score,
			}));

			// Step 7: Calculate tokens used
			//   const tokensUsed = await getAccurateTokenCount(response);
			const responseTime = Date.now() - startTime;

			return {
				content: response,
				sources: sources,
				// tokensUsed: tokensUsed || 0,
				responseTime: responseTime,
				model: 'gpt-4',
				hasRelevantContext: true,
			};
		} catch (error) {
			console.error('RAG generation error:', error);

			// Return error fallback
			const fallbackResponse = `I apologize, but I encountered an error while processing your question. Please try again later.`;

			return {
				content: fallbackResponse,
				sources: [],
				// tokensUsed: await getAccurateTokenCount(fallbackResponse),
				responseTime: 1000,
				model: 'gpt-4',
				hasRelevantContext: false,
				error: error.message,
			};
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
