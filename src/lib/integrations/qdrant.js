/**
 * Qdrant Vector Database Integration
 *
 * Handles vector database operations including collection management,
 * vector storage, search operations, and connection management.
 */

import { QdrantVectorStore } from '@langchain/qdrant';
import { QdrantClient } from '@qdrant/js-client-rest';
import { logInfo, logError } from '../utils/logger.js';
import { randomUUID } from 'crypto';

/**
 * Cache for vector store instances to avoid recreation
 */
const vectorStoreCache = new Map();

/**
 * Create Qdrant client instance
 * @param {Object} config - Qdrant configuration
 * @returns {QdrantClient} Qdrant client instance
 */
export function createQdrantClient(config = {}) {
	return new QdrantClient({
		url: config.url || process.env.QDRANT_URL || 'http://localhost:6333',
		apiKey: config.apiKey || process.env.QDRANT_API_KEY,
		...config,
	});
}

/**
 * Get or create vector store for a specific collection
 * @param {string} collectionName - Name of the collection
 * @param {OpenAIEmbeddings} embeddings - Embeddings instance
 * @param {Object} config - Vector store configuration
 * @returns {Promise<QdrantVectorStore>} Vector store instance
 */
export async function getVectorStore(collectionName, embeddings, config = {}) {
	const cacheKey = `${collectionName}-${config.userId || 'default'}`;

	// Check if we have a cached instance
	if (vectorStoreCache.has(cacheKey)) {
		return vectorStoreCache.get(cacheKey);
	}

	let vectorStore = null;

	try {
		logInfo('Connecting to vector store', { collectionName });

		// Try to connect to existing collection first
		vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
			url: process.env.QDRANT_URL || 'http://localhost:6333',
			collectionName,
			...config,
		});

		logInfo('Connected to existing collection', { collectionName });
	} catch (error) {
		logInfo('Collection does not exist, creating new one', { collectionName });

		// If collection doesn't exist, create a new vector store
		vectorStore = new QdrantVectorStore(embeddings, {
			url: process.env.QDRANT_URL || 'http://localhost:6333',
			collectionName,
			...config,
		});

		logInfo('Created new collection', { collectionName });
	}

	// Cache the vector store instance
	vectorStoreCache.set(cacheKey, vectorStore);
	return vectorStore;
}

/**
 * Store documents in vector collection with conflict resolution
 * @param {string} collectionName - Collection name
 * @param {OpenAIEmbeddings} embeddings - Embeddings instance
 * @param {Array} documents - Documents to store
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Storage results
 */
export async function storeDocuments(
	collectionName,
	embeddings,
	documents,
	metadata = {}
) {
	try {
		if (!documents || !Array.isArray(documents) || documents.length === 0) {
			throw new Error('documents array is required and must not be empty');
		}

		logInfo('Storing documents in vector store', {
			collectionName,
			documentCount: documents.length,
		});

		const vectorStore = await getVectorStore(collectionName, embeddings);

		// Generate unique IDs for documents to avoid conflicts
		console.log('🔑 [QDRANT] Generating UUID-based point IDs for documents...');

		const enrichedDocuments = documents.map((doc, index) => {
			// Create a valid UUID for Qdrant point ID
			const uniqueId = randomUUID();

			const enrichedMetadata = {
				...doc.metadata,
				...metadata,
				documentId: uniqueId,
				chunkIndex: doc.metadata.chunkIndex || index,
				timestamp: new Date().toISOString(),
			};

			return {
				...doc,
				metadata: enrichedMetadata,
				id: uniqueId, // Use UUID as point ID
			};
		});

		console.log('✅ [QDRANT] All UUIDs generated successfully', {
			totalDocuments: enrichedDocuments.length,
			sampleId: enrichedDocuments[0]?.id,
		});

		try {
			// Attempt to store documents with unique IDs
			const ids = await vectorStore.addDocuments(enrichedDocuments);

			// Handle case where addDocuments returns undefined (but storage still succeeds)
			const storedCount = Array.isArray(ids)
				? ids.length
				: enrichedDocuments.length;
			const documentIds = Array.isArray(ids) ? ids : [];

			logInfo('Documents stored successfully', {
				collectionName,
				documentCount: documents.length,
				storedIds: storedCount,
				returnedIds: Array.isArray(ids),
				idsType: typeof ids,
			});

			return {
				success: true,
				storedCount: storedCount,
				documentIds: documentIds,
			};
		} catch (storageError) {
			if (
				storageError.message.includes('Conflict') ||
				storageError.message.includes('already exists')
			) {
				logInfo('Conflict detected, attempting to store with new IDs', {
					collectionName,
					documentCount: documents.length,
				});

				// If conflict, regenerate IDs with additional randomness
				const reconflictedDocuments = enrichedDocuments.map((doc) => {
					const newUniqueId = randomUUID(); // Generate new UUID

					return {
						...doc,
						metadata: {
							...doc.metadata,
							documentId: newUniqueId,
							retryAttempt: true,
						},
						id: newUniqueId,
					};
				});

				// Try storing again with new IDs
				const retryIds = await vectorStore.addDocuments(reconflictedDocuments);

				// Handle case where addDocuments returns undefined (but storage still succeeds)
				const retryStoredCount = Array.isArray(retryIds)
					? retryIds.length
					: reconflictedDocuments.length;
				const retryDocumentIds = Array.isArray(retryIds) ? retryIds : [];

				logInfo('Documents stored successfully after retry', {
					collectionName,
					documentCount: documents.length,
					storedIds: retryStoredCount,
					returnedIds: Array.isArray(retryIds),
					retryAttempt: true,
				});

				return {
					success: true,
					storedCount: retryStoredCount,
					documentIds: retryDocumentIds,
				};
			} else {
				// If it's not a conflict error, rethrow
				throw storageError;
			}
		}
	} catch (error) {
		logError('Failed to store documents', {
			collectionName,
			error: error.message,
		});
		throw error;
	}
}

/**
 * Delete documents from collection by metadata filter
 * @param {string} collectionName - Collection name
 * @param {Object} filter - Filter to identify documents to delete
 * @returns {Promise<number>} Number of deleted documents
 */
export async function deleteDocuments(collectionName, filter) {
	try {
		logInfo('Deleting documents from collection', { collectionName, filter });

		const client = createQdrantClient();

		// Delete by filter
		const result = await client.delete(collectionName, {
			filter: {
				must: Object.entries(filter).map(([key, value]) => ({
					key: `metadata.${key}`,
					match: { value },
				})),
			},
		});

		logInfo('Documents deleted', {
			collectionName,
			deletedCount: result.operation_id,
		});

		return result.operation_id || 0;
	} catch (error) {
		logError('Failed to delete documents', {
			collectionName,
			error: error.message,
		});
		throw error;
	}
}

/**
 * Get collection information
 * @param {string} collectionName - Collection name
 * @returns {Promise<Object>} Collection info
 */
export async function getCollectionInfo(collectionName) {
	try {
		const client = createQdrantClient();
		const info = await client.getCollection(collectionName);

		logInfo('Retrieved collection info', {
			collectionName,
			pointsCount: info.points_count,
			vectorsCount: info.vectors_count,
		});

		return {
			name: collectionName,
			pointsCount: info.points_count,
			vectorsCount: info.vectors_count,
			config: info.config,
			status: info.status,
		};
	} catch (error) {
		logError('Failed to get collection info', {
			collectionName,
			error: error.message,
		});
		throw error;
	}
}

/**
 * Delete entire collection
 * @param {string} collectionName - Collection name to delete
 * @returns {Promise<boolean>} Success status
 */
export async function deleteCollection(collectionName) {
	try {
		logInfo('Deleting collection', { collectionName });

		const client = createQdrantClient();
		await client.deleteCollection(collectionName);

		// Remove from cache
		const keysToRemove = Array.from(vectorStoreCache.keys()).filter((key) =>
			key.startsWith(`${collectionName}-`)
		);

		keysToRemove.forEach((key) => vectorStoreCache.delete(key));

		logInfo('Collection deleted successfully', { collectionName });
		return true;
	} catch (error) {
		logError('Failed to delete collection', {
			collectionName,
			error: error.message,
		});
		throw error;
	}
}
