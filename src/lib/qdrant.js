import { QdrantClient } from '@qdrant/js-client-rest';

// Qdrant configuration
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const VECTOR_SIZE = 1536; // OpenAI text-embedding-3-small dimensions

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
        distance: 'Cosine', // Best for OpenAI embeddings
      },
      optimizers_config: {
        default_segment_number: 2,
      },
      replication_factor: 1,
    });
    
    console.log(`Collection ${collectionName} created successfully`);
    return { success: true, existed: false, collectionName };
    
  } catch (error) {
    console.error(`Error creating collection ${collectionName}:`, error);
    throw new Error(`Failed to create vector collection: ${error.message}`);
  }
}

/**
 * Delete a bot's collection
 */
export async function deleteBotCollection(userId, botId) {
  const client = getQdrantClient();
  const collectionName = getCollectionName(userId, botId);
  
  try {
    await client.deleteCollection(collectionName);
    console.log(`Collection ${collectionName} deleted successfully`);
    return { success: true, collectionName };
    
  } catch (error) {
    // If collection doesn't exist, that's okay
    if (error.message?.includes('Not found') || error.status === 404) {
      console.log(`Collection ${collectionName} does not exist, nothing to delete`);
      return { success: true, collectionName, existed: false };
    }
    
    console.error(`Error deleting collection ${collectionName}:`, error);
    throw new Error(`Failed to delete vector collection: ${error.message}`);
  }
}

/**
 * Store vectors in a bot's collection
 */
export async function storeVectors(userId, botId, vectors) {
  const client = getQdrantClient();
  const collectionName = getCollectionName(userId, botId);
  
  try {
    const points = vectors.map((vector, index) => ({
      id: vector.id || `${Date.now()}_${index}`,
      vector: vector.embedding,
      payload: {
        botId,
        userId,
        fileId: vector.fileId,
        chunkId: vector.chunkId,
        fileName: vector.fileName,
        chunkIndex: vector.chunkIndex,
        content: vector.content,
        tokens: vector.tokens,
        chunkType: vector.chunkType,
        createdAt: new Date().toISOString(),
        ...vector.metadata,
      },
    }));
    
    await client.upsert(collectionName, {
      wait: true,
      points,
    });
    
    console.log(`Stored ${points.length} vectors in collection ${collectionName}`);
    return {
      success: true,
      collectionName,
      storedCount: points.length,
      vectorIds: points.map(p => p.id),
    };
    
  } catch (error) {
    console.error(`Error storing vectors in ${collectionName}:`, error);
    throw new Error(`Failed to store vectors: ${error.message}`);
  }
}

/**
 * Search similar vectors in a bot's collection
 */
export async function searchVectors(userId, botId, queryVector, options = {}) {
  const client = getQdrantClient();
  const collectionName = getCollectionName(userId, botId);
  
  const {
    limit = 5,
    scoreThreshold = 0.7,
    filter = {},
  } = options;
  
  try {
    const searchResult = await client.search(collectionName, {
      vector: queryVector,
      limit,
      score_threshold: scoreThreshold,
      with_payload: true,
      with_vector: false,
      filter: {
        must: [
          { key: 'botId', match: { value: botId } },
          { key: 'userId', match: { value: userId } },
          ...Object.entries(filter).map(([key, value]) => ({
            key,
            match: { value },
          })),
        ],
      },
    });
    
    return {
      success: true,
      results: searchResult.map(result => ({
        id: result.id,
        score: result.score,
        content: result.payload.content,
        metadata: {
          fileId: result.payload.fileId,
          fileName: result.payload.fileName,
          chunkId: result.payload.chunkId,
          chunkIndex: result.payload.chunkIndex,
          tokens: result.payload.tokens,
          chunkType: result.payload.chunkType,
          createdAt: result.payload.createdAt,
        },
      })),
      totalFound: searchResult.length,
    };
    
  } catch (error) {
    // If collection doesn't exist, return empty results
    if (error.message?.includes('Not found') || error.status === 404) {
      console.log(`Collection ${collectionName} does not exist, returning empty results`);
      return {
        success: true,
        results: [],
        totalFound: 0,
        collectionNotFound: true,
      };
    }
    
    console.error(`Error searching in collection ${collectionName}:`, error);
    throw new Error(`Failed to search vectors: ${error.message}`);
  }
}

/**
 * Delete vectors by file ID
 */
export async function deleteVectorsByFileId(userId, botId, fileId) {
  const client = getQdrantClient();
  const collectionName = getCollectionName(userId, botId);
  
  try {
    await client.delete(collectionName, {
      filter: {
        must: [
          { key: 'botId', match: { value: botId } },
          { key: 'userId', match: { value: userId } },
          { key: 'fileId', match: { value: fileId } },
        ],
      },
    });
    
    console.log(`Deleted vectors for file ${fileId} in collection ${collectionName}`);
    return { success: true, fileId, collectionName };
    
  } catch (error) {
    console.error(`Error deleting vectors for file ${fileId}:`, error);
    throw new Error(`Failed to delete file vectors: ${error.message}`);
  }
}

/**
 * Get collection statistics
 */
export async function getCollectionStats(userId, botId) {
  const client = getQdrantClient();
  const collectionName = getCollectionName(userId, botId);
  
  try {
    const info = await client.getCollection(collectionName);
    return {
      success: true,
      stats: {
        vectorsCount: info.vectors_count || 0,
        indexedVectorsCount: info.indexed_vectors_count || 0,
        pointsCount: info.points_count || 0,
        status: info.status,
      },
    };
    
  } catch (error) {
    if (error.message?.includes('Not found') || error.status === 404) {
      return {
        success: true,
        stats: {
          vectorsCount: 0,
          indexedVectorsCount: 0,
          pointsCount: 0,
          status: 'not_found',
        },
        collectionNotFound: true,
      };
    }
    
    console.error(`Error getting collection stats for ${collectionName}:`, error);
    throw new Error(`Failed to get collection stats: ${error.message}`);
  }
}

/**
 * Health check for Qdrant connection
 */
export async function healthCheck() {
  try {
    const client = getQdrantClient();
    const collections = await client.getCollections();
    
    return {
      success: true,
      status: 'connected',
      url: QDRANT_URL,
      collectionsCount: collections.collections?.length || 0,
    };
    
  } catch (error) {
    console.error('Qdrant health check failed:', error);
    return {
      success: false,
      status: 'disconnected',
      url: QDRANT_URL,
      error: error.message,
    };
  }
}

const qdrantAPI = {
  getQdrantClient,
  getCollectionName,
  createBotCollection,
  deleteBotCollection,
  storeVectors,
  searchVectors,
  deleteVectorsByFileId,
  getCollectionStats,
  healthCheck,
};

export default qdrantAPI;