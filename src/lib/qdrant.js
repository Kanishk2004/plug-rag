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
 * Delete a bot's collection
 */
export async function deleteBotCollection(userId, botId) {
  const client = getQdrantClient();
  const collectionName = getCollectionName(userId, botId);
  
  try {
    await client.deleteCollection(collectionName);
    console.log(`Deleted collection: ${collectionName}`);
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
 * Store vectors in a bot's collection (temporarily disabled)
 * This will be rebuilt from scratch later
 */
export async function storeVectors(userId, botId, vectors) {
  console.log(`storeVectors called with ${vectors.length} vectors - NOT IMPLEMENTED`);
  console.log('This function needs to be rebuilt from scratch');
  
  // For now, just throw an error to avoid confusion
  throw new Error('Vector storage is temporarily disabled. Will be rebuilt from scratch.');
}

/**
 * Search for similar vectors in a bot's collection
 */
export async function searchVectors(userId, botId, queryVector, limit = 5) {
  const client = getQdrantClient();
  const collectionName = getCollectionName(userId, botId);
  
  try {
    const searchResult = await client.search(collectionName, {
      vector: queryVector,
      limit,
      with_payload: true,
    });
    
    return searchResult.map(result => ({
      id: result.id,
      score: result.score,
      payload: result.payload,
    }));
    
  } catch (error) {
    console.error(`Error searching vectors in ${collectionName}:`, error);
    throw new Error(`Failed to search vectors: ${error.message}`);
  }
}