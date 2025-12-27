/**
 * RAG Service
 *
 * Dedicated service for Retrieval-Augmented Generation operations
 * Handles document storage, retrieval, and generation pipeline
 */

import { QdrantVectorStore } from '@langchain/qdrant';
import { OpenAIEmbeddings } from '@langchain/openai';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { QdrantClient } from '@qdrant/js-client-rest';
import { createEmbeddingsInstance } from '../processors/embeddings.js';
import {
	storeDocuments,
	getCollectionInfo,
	listCollections,
} from '../integrations/qdrant.js';
import { logInfo, logError } from '../utils/logger.js';

/**
 * RAG Service Class
 */
export class RAGService {
	constructor() {
		// Initialize Qdrant client
		this.qdrantClient = new QdrantClient({
			url: process.env.QDRANT_URL || 'http://localhost:6333',
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
	 * Check if collection exists and get detailed info
	 */
	async getCollectionStatus(botId) {
		try {
			const collectionName = botId.toString();
			console.log(`🔍 [RAG] Checking collection status for: ${collectionName}`);

			// Check if collection exists
			const collections = await this.qdrantClient.getCollections();
			const collectionExists = collections.collections.some(
				(col) => col.name === collectionName
			);

			if (!collectionExists) {
				console.log(`❌ [RAG] Collection "${collectionName}" does not exist`);
				return {
					exists: false,
					pointsCount: 0,
					vectorsCount: 0,
					error: 'Collection not found',
				};
			}

			// Get detailed collection info
			const info = await getCollectionInfo(collectionName);
			console.log(`✅ [RAG] Collection "${collectionName}" status:`, {
				pointsCount: info.pointsCount,
				vectorsCount: info.vectorsCount,
			});

			return {
				exists: true,
				pointsCount: info.pointsCount,
				vectorsCount: info.vectorsCount,
				config: info.config,
			};
		} catch (error) {
			console.error(
				`💥 [RAG] Error checking collection status:`,
				error.message
			);
			return {
				exists: false,
				pointsCount: 0,
				vectorsCount: 0,
				error: error.message,
			};
		}
	}

	/**
	 * Store documents in vector database with comprehensive logging
	 */
	async storeDocuments(botId, apiKey, chunks, metadata = {}) {
		try {
			const collectionName = botId.toString();
			console.log(
				`📥 [RAG] Starting document storage for collection: ${collectionName}`
			);
			console.log(`📄 [RAG] Chunks to store: ${chunks.length}`);
			// Create embeddings instance
			const embeddings = createEmbeddingsInstance(apiKey, {
				model: 'text-embedding-3-small',
			});

			// Store documents using qdrant integration
			const result = await storeDocuments(collectionName, embeddings, chunks, {
				...metadata,
				botId: botId.toString(),
				storedAt: new Date().toISOString(),
			});

			console.log(`✅ [RAG] Chunks stored successfully:`, result);

			// Verify storage
			const status = await this.getCollectionStatus(botId);
			console.log(
				`🔍 [RAG] Post-storage collection status:`,
				status.config?.params.vectors
			);

			return {
				success: true,
				storedCount: result.storedCount,
				documentIds: result.documentIds,
				collectionStatus: status,
			};
		} catch (error) {
			console.error(`💥 [RAG] Document storage failed:`, error.message);
			console.error(
				`💥 [RAG] Error stack:`,
				error.stack?.split('\\n').slice(0, 3)
			);

			// Check if this is just a logging issue vs actual storage failure
			if (
				error.message.includes(
					"Cannot read properties of undefined (reading 'length')"
				)
			) {
				console.log(
					`⚠️ [RAG] This appears to be a logging issue - checking if storage actually succeeded...`
				);

				try {
					const status = await this.getCollectionStatus(botId);
					console.log(
						`🔍 [RAG] Collection status after 'failed' storage:`,
						status
					);

					if (status.pointsCount > 0) {
						console.log(
							`✅ [RAG] Storage actually succeeded despite error - documents are in vector DB`
						);
						return {
							success: true,
							storedCount: documents.length,
							documentIds: [],
							collectionStatus: status,
							note: 'Storage succeeded despite logging error',
						};
					}
				} catch (statusError) {
					console.error(
						`❌ [RAG] Could not verify storage status:`,
						statusError.message
					);
				}
			}

			throw new Error(`Document storage failed: ${error.message}`);
		}
	}

	/**
	 * Retrieve relevant documents with detailed debugging
	 */
	async retrieveDocuments(botId, apiKey, query, topK = 4) {
		try {
			const collectionName = botId.toString();
			console.log(
				`🔍 [RAG] Starting document retrieval for: ${collectionName}`
			);
			console.log(`❓ [RAG] Query: "${query.substring(0, 100)}..."`);

			// Check collection status first
			const status = await this.getCollectionStatus(botId);
			if (!status.exists) {
				console.log(`❌ [RAG] Collection does not exist`);
				return [];
			}

			if (status.pointsCount === 0) {
				console.log(`⚠️ [RAG] Collection exists but is empty (0 points)`);
				return [];
			}

			console.log(
				`✅ [RAG] Collection found with ${status.pointsCount} points`
			);

			// Create embeddings instance (must match storage model)
			const embeddings = new OpenAIEmbeddings({
				model: 'text-embedding-3-small',
				openAIApiKey: apiKey,
			});

			console.log(`🔗 [RAG] Creating vector store connection...`);

			// Initialize vector store
			const vectorStore = new QdrantVectorStore(embeddings, {
				client: this.qdrantClient,
				collectionName: collectionName,
				url: process.env.QDRANT_URL || 'http://localhost:6333',
			});

			console.log(`🔍 [RAG] Performing similarity search (topK: ${topK})`);

			// Perform similarity search
			const documents = await vectorStore.similaritySearch(query, topK);

			console.log(`📚 [RAG] Retrieved ${documents.length} documents`);

			if (documents.length > 0) {
				console.log(`📄 [RAG] Sample document:`, {
					content: documents[0].pageContent?.substring(0, 200) + '...',
					metadata: documents[0].metadata,
				});
			}

			return documents;
		} catch (error) {
			console.error(`💥 [RAG] Document retrieval failed:`, error.message);
			console.error(`💥 [RAG] Error details:`, {
				botId,
				collectionName: botId.toString(),
				query: query.substring(0, 100),
				stack: error.stack?.split('\\n').slice(0, 3),
			});

			// Return empty array instead of throwing to prevent chat failures
			return [];
		}
	}

	/**
	 * Generate RAG response with comprehensive logging
	 */
	async generateResponse(botId, apiKey, query, conversationHistory = []) {
		try {
			const startTime = Date.now();
			console.log(`🚀 [RAG] Starting response generation for bot: ${botId}`);

			// Retrieve relevant documents
			const documents = await this.retrieveDocuments(botId, apiKey, query, 4);

			if (documents.length === 0) {
				console.log(
					`⚠️ [RAG] No relevant documents found - returning fallback response`
				);
				return this.generateFallbackResponse();
			}

			console.log(
				`📚 [RAG] Found ${documents.length} relevant documents, generating response...`
			);

			// Format context and chat history
			const context = this.formatDocumentsAsContext(documents);
			const chatHistory = this.formatChatHistory(conversationHistory);

			// Create LLM instance
			const llm = new ChatOpenAI({
				model: 'gpt-4',
				temperature: 0.3,
				maxTokens: 1000,
				openAIApiKey: apiKey,
			});

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
			const response = await ragChain.invoke({ question: query });

			// Clean response
			const cleanResponse = response
				.replace(/\\s*\\[Source \\d+:[^\\]]+\\]\\s*/g, '')
				.trim();

			// Create source list
			const sources = documents.map((doc, index) => {
				const metadata = doc.metadata || {};
				return {
					fileName:
						metadata.fileName ||
						metadata.source ||
						metadata.filename ||
						'Unknown file',
					pageNumber: metadata.pageNumber || metadata.page || metadata.chunk,
					index: index + 1,
				};
			});

			const responseTime = Date.now() - startTime;
			const estimatedTokens = Math.ceil(cleanResponse.length * 0.75);

			console.log(`✅ [RAG] Response generated successfully`, {
				responseTime,
				tokensUsed: estimatedTokens,
				sourceCount: sources.length,
			});

			return {
				content: cleanResponse,
				sources: sources,
				responseTime: responseTime,
				tokensUsed: estimatedTokens,
				model: 'gpt-4',
				hasRelevantContext: true,
				documentsFound: documents.length,
			};
		} catch (error) {
			console.error(`💥 [RAG] Response generation failed:`, error.message);
			return this.generateFallbackResponse(error.message);
		}
	}

	/**
	 * Format documents as context
	 */
	formatDocumentsAsContext(documents) {
		if (!documents || documents.length === 0) {
			return 'No relevant documents found in the knowledge base.';
		}

		return documents
			.map((doc, index) => {
				const metadata = doc.metadata || {};
				const fileName =
					metadata.fileName ||
					metadata.source ||
					metadata.filename ||
					'Unknown file';
				const pageNumber =
					metadata.pageNumber || metadata.page || metadata.chunk;
				const pageInfo = pageNumber ? ` (Chunk ${pageNumber})` : '';
				return `[Source ${index + 1}: ${fileName}${pageInfo}]\\n${
					doc.pageContent
				}`;
			})
			.join('\\n\\n');
	}

	/**
	 * Format conversation history
	 */
	formatChatHistory(messages, maxMessages = 10) {
		if (!messages || messages.length === 0) {
			return 'No previous conversation.';
		}

		const recentMessages = messages
			.slice(-maxMessages - 1, -1)
			.map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
			.join('\\n');

		return recentMessages || 'No previous conversation.';
	}

	/**
	 * Generate fallback response
	 */
	generateFallbackResponse(errorMessage = null) {
		const baseMessage = `I'm sorry, but I couldn't find relevant information in my knowledge base to answer your question.`;
		const suggestions = [
			'Ask about the content in the uploaded documents',
			'Request summaries of specific topics',
			'Ask for details about processes or procedures mentioned in the files',
			'Inquire about data or information contained in the knowledge base',
		];

		let response = baseMessage;

		if (errorMessage) {
			response += `\\n\\nTechnical details: ${errorMessage}`;
		}

		response += `\\n\\nI can only provide answers based on the documents that have been uploaded to me. Here are some ways I can help:\\n\\n`;
		response += suggestions.map((suggestion) => `• ${suggestion}`).join('\\n');
		response += `\\n\\nPlease feel free to ask me about any topics covered in the uploaded documents!`;

		return {
			content: response,
			sources: [],
			responseTime: 100,
			tokensUsed: Math.ceil(response.length * 0.75),
			model: 'fallback',
			hasRelevantContext: false,
			documentsFound: 0,
		};
	}

	/**
	 * Get comprehensive system status for debugging
	 */
	async getSystemStatus() {
		try {
			console.log(`🔍 [RAG] Getting system status...`);

			// Test Qdrant connection
			const collections = await listCollections();

			const systemStatus = {
				qdrantConnected: true,
				totalCollections: collections.length,
				collections: [],
			};

			// Get detailed info for each collection
			for (const collectionName of collections) {
				try {
					const status = await this.getCollectionStatus(collectionName);
					systemStatus.collections.push({
						name: collectionName,
						...status,
					});
				} catch (error) {
					systemStatus.collections.push({
						name: collectionName,
						exists: false,
						error: error.message,
					});
				}
			}

			console.log(`✅ [RAG] System status retrieved:`, systemStatus);
			return systemStatus;
		} catch (error) {
			console.error(`💥 [RAG] Failed to get system status:`, error.message);
			return {
				qdrantConnected: false,
				error: error.message,
				totalCollections: 0,
				collections: [],
			};
		}
	}

	/**
	 * Debug a specific bot's RAG setup
	 */
	async debugBot(botId) {
		try {
			console.log(`🔧 [RAG] Starting debug analysis for bot: ${botId}`);

			const collectionName = botId.toString();
			const status = await this.getCollectionStatus(botId);

			const debugInfo = {
				botId: botId.toString(),
				collectionName,
				...status,
				timestamp: new Date().toISOString(),
			};

			if (status.exists && status.pointsCount > 0) {
				// Sample some documents
				try {
					const sampleResult = await this.qdrantClient.scroll(collectionName, {
						limit: 3,
						with_payload: true,
						with_vector: false,
					});

					if (sampleResult.points?.length > 0) {
						debugInfo.sampleDocuments = sampleResult.points.map((point) => ({
							id: point.id,
							metadata: point.payload?.metadata || {},
							contentPreview:
								point.payload?.page_content?.substring(0, 100) + '...' ||
								'No content',
							// Show original file references for easier debugging
							originalFileId:
								point.payload?.metadata?.originalFileId || 'Unknown',
							chunkIndex: point.payload?.metadata?.chunkIndex || 'Unknown',
						}));
					}
				} catch (error) {
					debugInfo.sampleError = error.message;
				}
			}

			console.log(`🔧 [RAG] Debug info for bot ${botId}:`, debugInfo);
			return debugInfo;
		} catch (error) {
			console.error(`💥 [RAG] Debug failed for bot ${botId}:`, error.message);
			return {
				botId: botId.toString(),
				error: error.message,
				timestamp: new Date().toISOString(),
			};
		}
	}
}

// Export singleton instance
export const ragService = new RAGService();
export default ragService;
