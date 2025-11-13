/**
 * Vector Store Operations
 *
 * This module handles all vector database operations including:
 * - Embedding generation using OpenAI
 * - Vector storage in Qdrant/Pinecone
 * - Vector search and retrieval
 * - Vector metadata management
 */

import { OpenAIEmbeddings } from '@langchain/openai';
import { QdrantVectorStore } from '@langchain/qdrant';
import { QdrantClient } from '@qdrant/js-client-rest';
import { encoding_for_model } from 'tiktoken';

// Initialize embeddings
const embeddings = new OpenAIEmbeddings({
	openAIApiKey: process.env.OPENAI_API_KEY,
	model: 'text-embedding-3-small',
});

// FUNCTIONS WE HAVE
// 1. getVectorStoreForBot(botKey)
// 2. storeDocumentsForBot(botKey, documents)

// Cache for bot-specific vector stores
const vectorStoreCache = new Map();

/**
 * Get or create vector store for a specific bot
 * @param {string} botKey - The bot identifier to use as collection name
 * @returns {Promise<QdrantVectorStore>} Vector store instance for the bot
 */
export async function getVectorStoreForBot(botKey) {
	// Check if we have a cached instance
	if (vectorStoreCache.has(botKey)) {
		return vectorStoreCache.get(botKey);
	}

	let vectorStore = null;

	try {
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
		vectorStore = new QdrantVectorStore(embeddings, {
			url: process.env.QDRANT_URL || 'http://localhost:6333',
			collectionName: botKey,
		});
		console.log(`[VECTOR-STORE] Created new collection: ${botKey}`);
	}

	// Cache the vector store instance
	vectorStoreCache.set(botKey, vectorStore);
	return vectorStore;
}

/**
 * Store documents in bot-specific vector collection
 * @param {string} botKey - The bot identifier to use as collection name
 * @param {Array} documents - Array of documents to store
 * @param {string} fileId - Optional file ID to add to metadata
 * @returns {Promise<Object>} Object containing token usage statistics and processing results
 */
export async function storeDocumentsForBot(botKey, documents, fileId = null) {
	try {
		if (!botKey) {
			throw new Error('botKey is required');
		}

		if (!documents || !Array.isArray(documents) || documents.length === 0) {
			throw new Error('documents array is required and must not be empty');
		}

		console.log(
			`[VECTOR-STORE] Storing ${documents.length} documents for bot: ${botKey}`
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

		// Get or create vector store for this bot
		const vectorStore = await getVectorStoreForBot(botKey);

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
 * Search vectors for a specific bot
 * @param {string} botKey - The bot identifier
 * @param {string} query - Search query
 * @param {number} limit - Number of results to return (default: 5)
 * @returns {Promise<Array>} Array of search results
 */
export async function searchVectorsForBot(botKey, query, limit = 5) {
	try {
		if (!botKey) {
			throw new Error('botKey is required');
		}

		if (!query) {
			throw new Error('query is required');
		}

		console.log(
			`[VECTOR-STORE] Searching vectors for bot: ${botKey}, query: "${query}"`
		);

		// Get vector store for this bot
		const vectorStore = await getVectorStoreForBot(botKey);

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
