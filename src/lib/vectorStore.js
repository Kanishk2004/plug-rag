/**
 * Vector Store Operations
 *
 * This module handles all vector database operations including:
 * - Embedding generation using OpenAI with bot-specific API keys
 * - Vector storage in Qdrant
 * - Vector search and retrieval
 * - Vector metadata management
 */

import { OpenAIEmbeddings } from '@langchain/openai';
import { QdrantVectorStore } from '@langchain/qdrant';
import { QdrantClient } from '@qdrant/js-client-rest';
import { encoding_for_model } from 'tiktoken';
import { apiKeyService } from './apiKeyService.js';
import connectDB from './mongo.js';
import Bot from '@/models/Bot.js';

// Cache for bot-specific vector stores - now includes userId for proper API key resolution
const vectorStoreCache = new Map();

/**
 * Get OpenAI embeddings instance for a specific bot using its API key configuration
 * @param {string} botId - The bot ID
 * @param {string} userId - The bot owner's user ID
 * @returns {Promise<OpenAIEmbeddings>} Configured embeddings instance
 */
async function getEmbeddingsForBot(botId, userId) {
	try {
		// Get bot-specific API key configuration
		const keyData = await apiKeyService.getApiKey(botId, userId);

		return new OpenAIEmbeddings({
			openAIApiKey: keyData.apiKey,
			model: keyData.models?.embeddings || 'text-embedding-3-small',
		});
	} catch (error) {
		// Fallback to global API key if available and bot allows fallback
		if (process.env.OPENAI_API_KEY) {
			console.warn(
				`[VECTOR-STORE] Using global API key fallback for bot ${botId}: ${error.message}`
			);
			return new OpenAIEmbeddings({
				openAIApiKey: process.env.OPENAI_API_KEY,
				model: 'text-embedding-3-small',
			});
		}
		throw new Error(
			`No OpenAI API key available for bot ${botId}: ${error.message}`
		);
	}
}

/**
 * Get or create vector store for a specific bot using its API key configuration
 * @param {string} botKey - The bot identifier to use as collection name
 * @param {string} userId - The bot owner's user ID for API key lookup
 * @returns {Promise<QdrantVectorStore>} Vector store instance for the bot
 */
export async function getVectorStoreForBot(botKey, userId) {
	// Create cache key with both botKey and userId for proper isolation
	const cacheKey = `${botKey}-${userId}`;

	// Check if we have a cached instance
	if (vectorStoreCache.has(cacheKey)) {
		return vectorStoreCache.get(cacheKey);
	}

	let vectorStore = null;

	try {
		// Get bot-specific embeddings using the bot's API key
		const embeddings = await getEmbeddingsForBot(botKey, userId);

		// Try to connect to existing collection first
		vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
			url: process.env.QDRANT_URL || 'http://localhost:6333',
			collectionName: botKey,
		});
		console.log(`[VECTOR-STORE] Connected to existing collection: ${botKey}`);
	} catch (error) {
		console.log(
			`[VECTOR-STORE] Collection ${botKey} does not exist, creating new one...`
		);
		// If collection doesn't exist, create a new vector store
		const embeddings = await getEmbeddingsForBot(botKey, userId);
		vectorStore = new QdrantVectorStore(embeddings, {
			url: process.env.QDRANT_URL || 'http://localhost:6333',
			collectionName: botKey,
		});
		console.log(`[VECTOR-STORE] Created new collection: ${botKey}`);
	}

	// Cache the vector store instance
	vectorStoreCache.set(cacheKey, vectorStore);
	return vectorStore;
}

/**
 * Store documents in bot-specific vector collection using the bot's API key
 * @param {string} botKey - The bot identifier to use as collection name
 * @param {Array} documents - Array of documents to store
 * @param {string} fileId - Optional file ID to add to metadata
 * @param {string} userId - The bot owner's user ID for API key lookup
 * @returns {Promise<Object>} Object containing token usage statistics and processing results
 */
export async function storeDocumentsForBot(
	botKey,
	documents,
	fileId = null,
	userId
) {
	try {
		if (!botKey) {
			throw new Error('botKey is required');
		}

		if (!userId) {
			// Try to resolve userId from bot if not provided
			await connectDB();
			const bot = await Bot.findById(botKey, 'ownerId');
			if (!bot) {
				throw new Error(`Bot ${botKey} not found`);
			}
			userId = bot.ownerId;
			console.log(`[VECTOR-STORE] Resolved userId ${userId} for bot ${botKey}`);
		}

		if (!documents || !Array.isArray(documents) || documents.length === 0) {
			throw new Error('documents array is required and must not be empty');
		}

		console.log(
			`[VECTOR-STORE] Storing ${documents.length} documents for bot: ${botKey} (owner: ${userId})`
		);

		// Calculate accurate token count for each document
		let totalTokensUsed = 0;
		let totalCharacters = 0;

		// Enrich documents with metadata and calculate token usage
		const enrichedDocuments = documents.map((doc) => {
			const enrichedMetadata = { ...doc.metadata };

			if (fileId) {
				enrichedMetadata.fileId = fileId.toString();
			}
			enrichedMetadata.botId = botKey;
			enrichedMetadata.storedAt = new Date().toISOString();

			// Calculate tokens for this document using tiktoken
			const docTokens = getAccurateTokenCount(doc.pageContent);
			totalTokensUsed += docTokens;
			totalCharacters += doc.pageContent.length;

			// Add token count to metadata for tracking
			enrichedMetadata.tokenCount = docTokens;

			return {
				...doc,
				metadata: enrichedMetadata,
			};
		});

		// Get or create vector store for this bot using its API key
		const vectorStore = await getVectorStoreForBot(botKey, userId);

		// Store enriched documents in the vector store
		const startTime = Date.now();
		await vectorStore.addDocuments(enrichedDocuments);
		const processingTime = Date.now() - startTime;

		// Calculate cost estimation
		const estimatedCost = calculateEmbeddingCost(totalTokensUsed);

		console.log(
			`[VECTOR-STORE] Successfully stored ${documents.length} documents`
		);
		console.log(`[VECTOR-STORE] Total tokens used: ${totalTokensUsed}`);
		console.log(`[VECTOR-STORE] Estimated cost: $${estimatedCost.toFixed(6)}`);

		// Return comprehensive token usage statistics
		return {
			success: true,
			documentsStored: documents.length,
			totalTokens: totalTokensUsed,
			totalCharacters: totalCharacters,
			estimatedCost: estimatedCost,
			processingTimeMs: processingTime,
			botKey: botKey,
			fileId: fileId,
		};
	} catch (error) {
		console.error(
			`[VECTOR-STORE] Error storing documents for bot ${botKey}:`,
			error
		);
		throw error;
	}
}

/**
 * Search vectors for a specific bot using its API key configuration
 * @param {string} botKey - The bot identifier
 * @param {string} query - Search query
 * @param {number} limit - Number of results to return (default: 5)
 * @param {string} userId - The bot owner's user ID for API key lookup
 * @returns {Promise<Array>} Array of search results
 */
export async function searchVectorsForBot(botKey, query, limit = 2, userId) {
	try {
		if (!botKey) {
			throw new Error('botKey is required');
		}

		if (!query) {
			throw new Error('query is required');
		}

		if (!userId) {
			// Try to resolve userId from bot if not provided
			await connectDB();
			const bot = await Bot.findById(botKey, 'ownerId');
			if (!bot) {
				throw new Error(`Bot ${botKey} not found`);
			}
			userId = bot.ownerId;
		}

		console.log(
			`[VECTOR-STORE] Searching vectors for bot: ${botKey}, query: "${query}"`
		);

		// Get vector store for this bot using its API key
		const vectorStore = await getVectorStoreForBot(botKey, userId);

		// Perform similarity search
		const results = await vectorStore.similaritySearch(query, limit);

		console.log(
			`[VECTOR-STORE] Found ${results.length} similar documents for bot: ${botKey}`
		);

		return results;
	} catch (error) {
		console.error(
			`[VECTOR-STORE] Error searching vectors for bot ${botKey}:`,
			error
		);
		throw error;
	}
}

/**
 * Delete vector collection for a specific bot
 * Permanently removes all vectors and the collection for the bot
 * @param {string} botKey - The bot identifier
 * @returns {Promise<boolean>} True if deletion was successful
 */
export async function deleteVectorCollectionForBot(botKey) {
	try {
		if (!botKey) {
			throw new Error('Bot key is required for collection deletion');
		}

		const collectionName = generateCollectionName(botKey);
		console.log(
			`[VECTOR-STORE] Deleting collection: ${collectionName} for bot: ${botKey}`
		);

		const client = new QdrantClient({
			url: process.env.QDRANT_URL || 'http://localhost:6333',
			apiKey: process.env.QDRANT_API_KEY,
		});

		// Check if collection exists before attempting deletion
		try {
			await client.getCollection(collectionName);
		} catch (error) {
			console.log(
				`[VECTOR-STORE] Collection ${collectionName} does not exist, skipping deletion`
			);
			return true;
		}

		// Delete the entire collection
		await client.deleteCollection(collectionName);

		// Remove from cache if it exists
		if (vectorStoreCache.has(botKey)) {
			vectorStoreCache.delete(botKey);
		}

		console.log(
			`[VECTOR-STORE] Successfully deleted collection: ${collectionName} for bot: ${botKey}`
		);
		return true;
	} catch (error) {
		console.error(
			`[VECTOR-STORE] Error deleting collection for bot ${botKey}:`,
			error
		);
		throw error;
	}
}

/**
 * Get accurate token count for text using tiktoken
 * @param {string} text - Text to count tokens for
 * @param {string} model - Model to use for token counting (default: text-embedding-3-small)
 * @returns {number} Accurate token count
 */
function getAccurateTokenCount(text, model = 'text-embedding-3-small') {
	try {
		const encoding = encoding_for_model(model);
		const tokens = encoding.encode(text);
		const tokenCount = tokens.length;
		encoding.free();
		return tokenCount;
	} catch (error) {
		console.warn(
			'[VECTOR-STORE] Tiktoken error, falling back to estimation:',
			error
		);
		// Fallback to character-based estimation (roughly 1 token per 4 characters)
		return Math.ceil(text.length / 4);
	}
}

/**
 * Calculate embedding cost based on token count
 * Uses OpenAI's text-embedding-3-small pricing: $0.00002 per 1K tokens
 * @param {number} tokenCount - Number of tokens
 * @returns {number} Cost in USD
 */
function calculateEmbeddingCost(tokenCount) {
	// OpenAI text-embedding-3-small pricing: $0.00002 per 1K tokens
	const pricePerThousandTokens = 0.00002;
	return (tokenCount / 1000) * pricePerThousandTokens;
}
