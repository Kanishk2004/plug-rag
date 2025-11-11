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

// Initialize embeddings
const embeddings = new OpenAIEmbeddings({
	openAIApiKey: process.env.OPENAI_API_KEY,
	model: 'text-embedding-3-large',
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
 * @returns {Promise<Array>} Array of vector IDs
 */
export async function storeDocumentsForBot(botKey, documents) {
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

		// Get or create vector store for this bot
		const vectorStore = await getVectorStoreForBot(botKey);

		// Store documents in the vector store
		const vectorIds = await vectorStore.addDocuments(documents);

		console.log(
			`[VECTOR-STORE] Successfully stored vectors for bot: ${botKey}`
		);

		return vectorIds;
	} catch (error) {
		console.error(
			`[VECTOR-STORE] Error storing documents for bot ${botKey}:`,
			error
		);
		throw error;
	}
}
