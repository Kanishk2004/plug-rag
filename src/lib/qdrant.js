import { QdrantClient } from '@qdrant/js-client-rest';

// Qdrant configuration
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const VECTOR_SIZE = 1536; // OpenAI text-embedding-3-small dimensions
// Enhanced error logging for debugging

// Initialize Qdrant client
let qdrantClient = null;

/**
 * Get or create Qdrant client instance
 */
export function getQdrantClient() {
  if (!qdrantClient) {
    qdrantClient = new QdrantClient({
      url: QDRANT_URL,
    });
  }
  return qdrantClient;
}

/**
 * Generate collection name using userId and botId convention
 */
export function getCollectionName(userId, botId) {
  return `${userId}_${botId}`;
}

/**
 * Create a new collection for a bot
 */
export async function createBotCollection(userId, botId) {
  const client = getQdrantClient();
  const collectionName = getCollectionName(userId, botId);
  
  try {
    // Check if collection already exists
    const collections = await client.getCollections();
    const existingCollection = collections.collections?.find(
      col => col.name === collectionName
    );
    
    if (existingCollection) {
      console.log(`Collection ${collectionName} already exists`);
      return { success: true, existed: true, collectionName };
    }
    
    // Create new collection
    await client.createCollection(collectionName, {
      vectors: {
        size: VECTOR_SIZE,
        distance: 'Cosine',
      },
    });
    
    console.log(`Created collection: ${collectionName}`);
    return { success: true, existed: false, collectionName };
    
  } catch (error) {
    console.error(`Error creating collection ${collectionName}:`, error);
    throw new Error(`Failed to create vector collection: ${error.message}`);
  }
}

/**
 * Delete a bot's collection (legacy function for backward compatibility)
 */
export async function deleteBotCollection(userId, botId) {
  const collectionName = getCollectionName(userId, botId);
  return await deleteCollection(collectionName);
}

/**
 * Store/upsert vectors in a collection
 * Industry-standard implementation with batch processing
 */
export async function upsertVectors(collectionName, vectors) {
  const client = getQdrantClient();
  
  try {
    console.log(`[QDRANT] Upserting ${vectors.length} vectors to collection: ${collectionName}`);
    
    // Validate vectors format
    if (!Array.isArray(vectors) || vectors.length === 0) {
      throw new Error('Invalid vectors array provided');
    }

    // Validate vector structure
    for (const vector of vectors) {
      if (!vector.id || !vector.vector || !Array.isArray(vector.vector)) {
        console.error('[QDRANT] ❌ Invalid vector structure:', {
          hasId: !!vector.id,
          hasVector: !!vector.vector,
          isVectorArray: Array.isArray(vector.vector),
          vectorStructure: Object.keys(vector)
        });
        throw new Error('Invalid vector structure: missing id or vector array');
      }
      if (vector.vector.length !== VECTOR_SIZE) {
        console.error('[QDRANT] ❌ Invalid vector dimension:', {
          vectorId: vector.id,
          expectedDimension: VECTOR_SIZE,
          actualDimension: vector.vector.length,
          vectorType: typeof vector.vector[0]
        });
        throw new Error(`Invalid vector dimension: expected ${VECTOR_SIZE}, got ${vector.vector.length}`);
      }
    }

    console.log('[QDRANT] 🐛 DEBUG: Upserting vectors with structure:', {
      collectionName,
      vectorCount: vectors.length,
      firstVectorSample: {
        id: vectors[0]?.id,
        vectorLength: vectors[0]?.vector?.length,
        vectorType: typeof vectors[0]?.vector?.[0],
        payloadKeys: Object.keys(vectors[0]?.payload || {}),
        vectorSample: vectors[0]?.vector?.slice(0, 3)
      }
    });

    // Upsert vectors using Qdrant client
    const response = await client.upsert(collectionName, {
      wait: true, // Wait for the operation to complete
      points: vectors.map(v => ({
        id: v.id,
        vector: v.vector,
        payload: v.payload || {}
      }))
    });

    console.log(`[QDRANT] ✅ Successfully upserted ${vectors.length} vectors`);
    return response;

  } catch (error) {
    console.error(`[QDRANT] ❌ Error upserting vectors to ${collectionName}:`, {
      errorMessage: error.message,
      errorStatus: error.status,
      errorCode: error.code,
      errorDetails: error.response?.data || error.data,
      vectorCount: vectors?.length,
      collectionName
    });
    
    // Log the first vector structure for debugging
    if (vectors && vectors.length > 0) {
      console.error('[QDRANT] 🐛 First vector structure that failed:', {
        id: vectors[0].id,
        idType: typeof vectors[0].id,
        vectorLength: vectors[0].vector?.length,
        vectorType: typeof vectors[0].vector?.[0],
        payloadKeys: Object.keys(vectors[0].payload || {})
      });
    }
    
    throw new Error(`Failed to upsert vectors: ${error.message}`);
  }
}

/**
 * Delete specific vectors from a collection
 */
export async function deleteVectors(collectionName, vectorIds) {
  const client = getQdrantClient();
  
  try {
    console.log(`[QDRANT] Deleting ${vectorIds.length} vectors from collection: ${collectionName}`);
    
    if (!Array.isArray(vectorIds) || vectorIds.length === 0) {
      throw new Error('Invalid vector IDs array provided');
    }

    const response = await client.delete(collectionName, {
      wait: true,
      points: vectorIds
    });

    console.log(`[QDRANT] ✅ Successfully deleted ${vectorIds.length} vectors`);
    return response;

  } catch (error) {
    console.error(`[QDRANT] ❌ Error deleting vectors from ${collectionName}:`, error);
    throw new Error(`Failed to delete vectors: ${error.message}`);
  }
}

/**
 * Delete a collection
 */
export async function deleteCollection(collectionName) {
  const client = getQdrantClient();
  
  try {
    console.log(`[QDRANT] Deleting collection: ${collectionName}`);
    
    await client.deleteCollection(collectionName);
    console.log(`[QDRANT] ✅ Successfully deleted collection: ${collectionName}`);
    
    return { success: true, collectionName };
    
  } catch (error) {
    // If collection doesn't exist, that's okay
    if (error.message?.includes('Not found') || error.status === 404) {
      console.log(`[QDRANT] ⚠️ Collection ${collectionName} does not exist, nothing to delete`);
      return { success: true, collectionName, existed: false };
    }
    
    console.error(`[QDRANT] ❌ Error deleting collection ${collectionName}:`, error);
    throw new Error(`Failed to delete collection: ${error.message}`);
  }
}

/**
 * Search for similar vectors with advanced filtering
 */
export async function searchVectors(collectionName, queryVector, options = {}) {
  const client = getQdrantClient();
  
  try {
    console.log(`[QDRANT] Searching in collection: ${collectionName}`, {
      limit: options.limit || 10,
      scoreThreshold: options.scoreThreshold
    });
    
    if (!Array.isArray(queryVector) || queryVector.length !== VECTOR_SIZE) {
      throw new Error(`Invalid query vector: expected array of length ${VECTOR_SIZE}`);
    }

    const searchParams = {
      vector: queryVector,
      limit: options.limit || 10,
      with_payload: true,
      with_vector: false // Don't return vectors to save bandwidth
    };

    // Add score threshold if specified
    if (options.scoreThreshold) {
      searchParams.score_threshold = options.scoreThreshold;
    }

    // Add filter if specified
    if (options.filter) {
      searchParams.filter = options.filter;
    }

    const searchResult = await client.search(collectionName, searchParams);
    
    console.log(`[QDRANT] ✅ Search completed, found ${searchResult.length} results`);
    
    return searchResult.map(result => ({
      id: result.id,
      score: result.score,
      payload: result.payload,
    }));
    
  } catch (error) {
    console.error(`[QDRANT] ❌ Error searching vectors in ${collectionName}:`, error);
    throw new Error(`Failed to search vectors: ${error.message}`);
  }
}

/**
 * Health check for Qdrant service
 */
export async function healthCheck() {
  const client = getQdrantClient();
  
  try {
    console.log('[QDRANT] Performing health check...');
    
    // Try to get collections list as a health check
    const collections = await client.getCollections();
    
    console.log(`[QDRANT] ✅ Health check passed, found ${collections.collections?.length || 0} collections`);
    
    return {
      status: 'healthy',
      collectionsCount: collections.collections?.length || 0,
      url: QDRANT_URL
    };
    
  } catch (error) {
    console.error('[QDRANT] ❌ Health check failed:', error);
    return {
      status: 'failed',
      error: error.message,
      url: QDRANT_URL
    };
  }
}