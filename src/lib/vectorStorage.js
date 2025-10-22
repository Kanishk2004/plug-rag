import qdrantAPI from './qdrant.js';
import embeddingsAPI from './embeddings.js';
import Bot from '@/models/Bot.js';
import File from '@/models/File.js';
import Chunk from '@/models/Chunk.js';

/**
 * Vector storage service that handles the complete flow:
 * 1. Generate embeddings for chunks
 * 2. Store vectors in Qdrant
 * 3. Update MongoDB records
 */

/**
 * Initialize vector storage for a new bot
 */
export async function initializeBotVectorStorage(userId, botId) {
  try {
    // Create Qdrant collection for the bot
    const collectionResult = await qdrantAPI.createBotCollection(userId, botId);
    
    // Update bot document with vector storage info
    await Bot.findByIdAndUpdate(botId, {
      'vectorStorage.enabled': true,
      'vectorStorage.collectionName': collectionResult.collectionName,
      'vectorStorage.provider': 'qdrant',
      'vectorStorage.dimensions': 1536,
      'vectorStorage.model': 'text-embedding-3-small',
      'vectorStorage.createdAt': new Date(),
    });
    
    return {
      success: true,
      collectionName: collectionResult.collectionName,
      existed: collectionResult.existed,
    };
    
  } catch (error) {
    console.error('Error initializing bot vector storage:', error);
    throw new Error(`Failed to initialize vector storage: ${error.message}`);
  }
}

/**
 * Process file chunks and store as vectors
 */
export async function processFileToVectors(userId, botId, fileId) {
  try {
    // Get file and its chunks from MongoDB
    const file = await File.findById(fileId).populate('chunks');
    if (!file) {
      throw new Error('File not found');
    }
    
    // Verify file belongs to the bot
    if (file.botId.toString() !== botId) {
      throw new Error('File does not belong to this bot');
    }
    
    const chunks = await Chunk.find({ fileId }).sort({ chunkIndex: 1 });
    if (chunks.length === 0) {
      throw new Error('No chunks found for file');
    }
    
    // Generate embeddings for all chunks
    console.log(`Generating embeddings for ${chunks.length} chunks from file ${file.originalName}`);
    const embeddingResult = await embeddingsAPI.generateChunkEmbeddings(
      chunks.map(chunk => ({
        id: chunk._id.toString(),
        content: chunk.content,
        tokens: chunk.tokens,
        type: chunk.type,
        chunkIndex: chunk.chunkIndex,
      })),
      fileId,
      file.originalName
    );
    
    // Store vectors in Qdrant
    console.log(`Storing ${embeddingResult.vectors.length} vectors in Qdrant`);
    const storageResult = await qdrantAPI.storeVectors(
      userId,
      botId,
      embeddingResult.vectors
    );
    
    // Update chunk documents with embedding status
    const chunkUpdatePromises = chunks.map(chunk => 
      Chunk.findByIdAndUpdate(chunk._id, {
        embeddingStatus: 'completed',
        embeddedAt: new Date(),
      })
    );
    await Promise.all(chunkUpdatePromises);
    
    // Update file document
    await File.findByIdAndUpdate(fileId, {
      embeddingStatus: 'completed',
      embeddedAt: new Date(),
      vectorCount: embeddingResult.vectors.length,
      'processing.embeddingTokens': embeddingResult.usage.total_tokens,
    });
    
    // Update bot analytics
    await Bot.findByIdAndUpdate(botId, {
      $inc: {
        'analytics.totalEmbeddings': embeddingResult.vectors.length,
        'analytics.totalTokensUsed': embeddingResult.usage.total_tokens,
      },
    });
    
    return {
      success: true,
      fileId,
      fileName: file.originalName,
      vectorsStored: storageResult.storedCount,
      tokensUsed: embeddingResult.usage.total_tokens,
      collectionName: storageResult.collectionName,
    };
    
  } catch (error) {
    console.error('Error processing file to vectors:', error);
    
    // Update file status to failed
    try {
      await File.findByIdAndUpdate(fileId, {
        embeddingStatus: 'failed',
        'processing.error': error.message,
      });
    } catch (updateError) {
      console.error('Error updating file status:', updateError);
    }
    
    throw new Error(`Failed to process file to vectors: ${error.message}`);
  }
}

/**
 * Delete file vectors from storage
 */
export async function deleteFileVectors(userId, botId, fileId) {
  try {
    // Delete vectors from Qdrant
    await qdrantAPI.deleteVectorsByFileId(userId, botId, fileId);
    
    // Update chunks
    await Chunk.updateMany(
      { fileId },
      {
        embeddingStatus: 'deleted',
        embeddedAt: null,
      }
    );
    
    // Update file
    await File.findByIdAndUpdate(fileId, {
      embeddingStatus: 'deleted',
      embeddedAt: null,
      vectorCount: 0,
    });
    
    return {
      success: true,
      fileId,
      message: 'File vectors deleted successfully',
    };
    
  } catch (error) {
    console.error('Error deleting file vectors:', error);
    throw new Error(`Failed to delete file vectors: ${error.message}`);
  }
}

/**
 * Search for similar content in a bot's vector collection
 */
export async function searchSimilarContent(userId, botId, query, options = {}) {
  try {
    // Generate embedding for the query
    const queryEmbedding = await embeddingsAPI.generateEmbedding(query);
    
    // Search in Qdrant
    const searchResult = await qdrantAPI.searchVectors(
      userId,
      botId,
      queryEmbedding.embedding,
      {
        limit: options.limit || 5,
        scoreThreshold: options.scoreThreshold || 0.7,
        filter: options.filter || {},
      }
    );
    
    return {
      success: true,
      query,
      results: searchResult.results,
      totalFound: searchResult.totalFound,
      tokensUsed: queryEmbedding.usage.total_tokens,
      collectionNotFound: searchResult.collectionNotFound,
    };
    
  } catch (error) {
    console.error('Error searching similar content:', error);
    throw new Error(`Failed to search similar content: ${error.message}`);
  }
}

/**
 * Clean up bot vector storage (delete collection)
 */
export async function cleanupBotVectorStorage(userId, botId) {
  try {
    // Delete Qdrant collection
    await qdrantAPI.deleteBotCollection(userId, botId);
    
    // Update bot document
    await Bot.findByIdAndUpdate(botId, {
      'vectorStorage.enabled': false,
      'vectorStorage.deletedAt': new Date(),
    });
    
    // Update all files and chunks for this bot
    const files = await File.find({ botId });
    for (const file of files) {
      await File.findByIdAndUpdate(file._id, {
        embeddingStatus: 'deleted',
        embeddedAt: null,
        vectorCount: 0,
      });
      
      await Chunk.updateMany(
        { fileId: file._id },
        {
          embeddingStatus: 'deleted',
          embeddedAt: null,
        }
      );
    }
    
    return {
      success: true,
      botId,
      message: 'Bot vector storage cleaned up successfully',
    };
    
  } catch (error) {
    console.error('Error cleaning up bot vector storage:', error);
    throw new Error(`Failed to cleanup bot vector storage: ${error.message}`);
  }
}

/**
 * Get vector storage statistics for a bot
 */
export async function getBotVectorStats(userId, botId) {
  try {
    // Get Qdrant collection stats
    const qdrantStats = await qdrantAPI.getCollectionStats(userId, botId);
    
    // Get MongoDB stats
    const fileCount = await File.countDocuments({ 
      botId, 
      embeddingStatus: 'completed' 
    });
    
    const chunkCount = await Chunk.countDocuments({
      botId,
      embeddingStatus: 'completed',
    });
    
    const bot = await Bot.findById(botId);
    
    return {
      success: true,
      stats: {
        qdrant: qdrantStats.stats,
        mongodb: {
          filesWithEmbeddings: fileCount,
          chunksWithEmbeddings: chunkCount,
        },
        bot: {
          totalEmbeddings: bot?.analytics?.totalEmbeddings || 0,
          totalTokensUsed: bot?.analytics?.totalTokensUsed || 0,
        },
        collectionNotFound: qdrantStats.collectionNotFound,
      },
    };
    
  } catch (error) {
    console.error('Error getting bot vector stats:', error);
    throw new Error(`Failed to get bot vector stats: ${error.message}`);
  }
}

/**
 * Health check for vector storage system
 */
export async function vectorStorageHealthCheck() {
  try {
    // Test Qdrant connection
    const qdrantHealth = await qdrantAPI.healthCheck();
    
    // Test OpenAI connection
    const openaiHealth = await embeddingsAPI.testConnection();
    
    return {
      success: qdrantHealth.success && openaiHealth.success,
      qdrant: qdrantHealth,
      openai: openaiHealth,
      overall: qdrantHealth.success && openaiHealth.success ? 'healthy' : 'unhealthy',
    };
    
  } catch (error) {
    console.error('Vector storage health check failed:', error);
    return {
      success: false,
      overall: 'unhealthy',
      error: error.message,
    };
  }
}

const vectorStorageAPI = {
  initializeBotVectorStorage,
  processFileToVectors,
  deleteFileVectors,
  searchSimilarContent,
  cleanupBotVectorStorage,
  getBotVectorStats,
  vectorStorageHealthCheck,
};

export default vectorStorageAPI;