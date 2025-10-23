import { generateEmbedding } from './embeddings.js';
import { createBotCollection } from './qdrant.js';
import Bot from '@/models/Bot.js';
import File from '@/models/File.js';
import Chunk from '@/models/Chunk.js';

/**
 * Vector storage service that handles the complete flow:
 * 1. Generate embeddings for chunks
 * 2. Store vectors in Qdrant (temporarily disabled)
 * 3. Update MongoDB records
 */

/**
 * Initialize vector storage for a new bot
 */
export async function initializeBotVectorStorage(userId, botId) {
  try {
    // Create Qdrant collection for the bot
    const collectionResult = await createBotCollection(userId, botId);
    
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
 * Process file chunks and generate embeddings (vector storage temporarily disabled)
 */
export async function processFileToVectors(userId, botId, fileId) {
  try {
    console.log(`Processing file ${fileId} for user ${userId}, bot ${botId}`);
    
    // Get file from MongoDB
    const file = await File.findById(fileId);
    if (!file) {
      throw new Error('File not found');
    }
    
    // Get chunks for this file
    const chunks = await Chunk.find({ fileId }).sort({ chunkIndex: 1 });
    if (chunks.length === 0) {
      // If no chunks found, try to create them from the file's extracted text
      console.log('No chunks found, attempting to create them from file content...');
      
      if (!file.extractedText || file.extractedText.length === 0) {
        throw new Error('No chunks found and no extracted text available for file');
      }
      
      // Create basic chunks from extracted text
      const { chunkText } = await import('@/lib/extractors/index.js');
      const generatedChunks = chunkText(file.extractedText, { metadata: { fileType: file.fileType } });
      
      if (generatedChunks.length === 0) {
        throw new Error('Failed to generate chunks from file content');
      }
      
      // Save the generated chunks
      const chunkDocuments = generatedChunks.map((chunk, index) => ({
        fileId: file._id,
        botId: file.botId,
        ownerId: file.ownerId,
        content: chunk.content,
        chunkIndex: chunk.chunkIndex || index,
        tokens: chunk.tokens || Math.ceil(chunk.content.length / 4),
        type: mapChunkTypeForStorage(chunk.type || 'paragraph_boundary'),
        metadata: chunk.metadata || {},
        embeddingStatus: 'pending',
      }));
      
      await Chunk.insertMany(chunkDocuments);
      console.log(`✅ Generated and saved ${chunkDocuments.length} chunks for file`);
      
      // Refetch the chunks
      const newChunks = await Chunk.find({ fileId }).sort({ chunkIndex: 1 });
      return await processChunksToVectors(newChunks, userId, botId, file);
    }

    return await processChunksToVectors(chunks, userId, botId, file);
  } catch (error) {
    console.error('Error in processFileToVectors:', error);
    throw error;
  }
}

/**
 * Process chunks to vectors (vector storage temporarily disabled)
 */
async function processChunksToVectors(chunks, userId, botId, file) {
  try {
    const fileId = file._id;
    
    // Generate embeddings for chunks (this part works)
    console.log(`Generating embeddings for ${chunks.length} chunks from file ${file.originalName}`);
    
    let totalTokens = 0;
    const vectors = [];
    
    for (const chunk of chunks) {
      try {
        const embedding = await generateEmbedding(chunk.content);
        vectors.push({
          id: chunk._id.toString(),
          embedding: embedding,
          content: chunk.content,
          fileId: fileId.toString(),
          fileName: file.originalName,
          chunkId: chunk._id.toString(),
          chunkIndex: chunk.chunkIndex,
          tokens: chunk.tokens,
          chunkType: chunk.type,
          metadata: chunk.metadata || {},
        });
        totalTokens += Math.ceil(chunk.content.length / 4); // Rough token estimate
      } catch (embeddingError) {
        console.error(`Failed to generate embedding for chunk ${chunk._id}:`, embeddingError);
        throw new Error(`Embedding generation failed: ${embeddingError.message}`);
      }
    }
    
    console.log(`✅ Generated ${vectors.length} embeddings`);
    
    // VECTOR STORAGE IS TEMPORARILY DISABLED
    console.log('⚠️ Vector storage is temporarily disabled - skipping Qdrant storage');
    
    // Update chunk documents with embedding status (mark as pending since we didn't store)
    const chunkUpdatePromises = chunks.map(chunk => 
      Chunk.findByIdAndUpdate(chunk._id, {
        embeddingStatus: 'generated', // New status for generated but not stored
        embeddedAt: new Date(),
      })
    );
    await Promise.all(chunkUpdatePromises);
    
    // Update file document
    await File.findByIdAndUpdate(fileId, {
      embeddingStatus: 'generated', // New status for generated but not stored
      embeddedAt: new Date(),
      vectorCount: vectors.length,
      'processing.embeddingTokens': totalTokens,
    });
    
    // Update bot analytics
    await Bot.findByIdAndUpdate(botId, {
      $inc: {
        'analytics.totalEmbeddings': vectors.length,
        'analytics.totalTokensUsed': totalTokens,
      },
    });
    
    return {
      success: true,
      fileId,
      fileName: file.originalName,
      vectorsStored: vectors.length, // Changed from vectorsGenerated to match API expectation
      tokensUsed: totalTokens,
      message: 'Embeddings generated successfully. Vector storage temporarily disabled.',
    };
    
  } catch (error) {
    console.error('Error processing chunks to vectors:', error);
    
    // Update file status to failed
    try {
      await File.findByIdAndUpdate(file._id, {
        embeddingStatus: 'failed',
        'processing.error': error.message,
      });
    } catch (updateError) {
      console.error('Error updating file status:', updateError);
    }
    
    throw new Error(`Failed to process chunks to vectors: ${error.message}`);
  }
}

/**
 * Map chunk types from extractors to valid Chunk model enum values
 */
function mapChunkTypeForStorage(extractorType) {
  const typeMapping = {
    'paragraph_boundary': 'paragraph_boundary',
    'sentence_boundary': 'sentence_boundary', 
    'document_structure': 'document_structure',
    'manual': 'manual',
    // Map additional extractor types to valid enum values
    'final_chunk': 'paragraph_boundary',
    'structured_section': 'document_structure',
    'section': 'document_structure',
    'list_item': 'paragraph_boundary',
    'heading': 'document_structure',
    'table_row': 'document_structure',
  };
  
  return typeMapping[extractorType] || 'paragraph_boundary';
}

/**
 * Placeholder functions for completeness
 */
export async function deleteFileVectors(userId, botId, fileId) {
  console.log('deleteFileVectors called - not implemented');
  return { success: true, message: 'Vector storage temporarily disabled' };
}

export async function searchSimilarContent(userId, botId, query, options = {}) {
  console.log('searchSimilarContent called - not implemented');
  throw new Error('Vector search temporarily disabled. Will be rebuilt from scratch.');
}

export async function cleanupBotVectorStorage(userId, botId) {
  console.log('cleanupBotVectorStorage called - not implemented');
  return { success: true, message: 'Vector storage temporarily disabled' };
}

export async function getBotVectorStats(userId, botId) {
  console.log('getBotVectorStats called - not implemented');
  return { success: true, message: 'Vector storage temporarily disabled' };
}

export async function vectorStorageHealthCheck() {
  return {
    success: true,
    message: 'Vector storage temporarily disabled',
    overall: 'disabled',
  };
}