/**
 * File Service
 * 
 * Core business logic for file management including file processing,
 * chunking, embedding generation, and file lifecycle management.
 */

import { logInfo, logError } from '../utils/logger.js';
import { createPerformanceTimer } from '../utils/performance.js';
import { validateFile, validateTextContent } from '../processors/validator.js';
import { extractText } from '../processors/textExtractor.js';
import { chunkText } from '../processors/chunker.js';
import { generateEmbeddings } from '../processors/embeddings.js';
import { storeDocuments } from '../integrations/qdrant.js';
import { createEmbeddingsInstance } from '../processors/embeddings.js';
import { apiKeyService } from './apiKeyService.js';
import connectDB from '../integrations/mongo.js';
import File from '@/models/File.js';

/**
 * Custom error class for file-related errors
 */
export class FileError extends Error {
  constructor(message, status = 400, code = null) {
    super(message);
    this.name = 'FileError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Process uploaded file through the complete pipeline
 * @param {File} file - Uploaded file object
 * @param {Buffer} fileBuffer - File content buffer
 * @param {string} botId - Bot ID
 * @param {string} userId - User ID
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Processing results
 */
export async function processFile(file, fileBuffer, botId, userId, options = {}) {
  const {
    generateEmbeddings = true,
    maxChunkSize = 700,
    overlap = 100,
    skipValidation = false
  } = options;

  const timer = createPerformanceTimer('File Processing');
  let fileRecord = null;
  let documents = [];

  try {
    logInfo('Starting file processing', {
      fileName: file.name,
      fileSize: fileBuffer.length,
      botId,
      userId,
      generateEmbeddings,
      maxChunkSize,
      overlap
    });

    // Step 1: Validate file
    if (!skipValidation) {
      const validation = validateFile(file, fileBuffer);
      if (!validation.isValid) {
        throw new FileError(`File validation failed: ${validation.errors.join(', ')}`, 400);
      }

      if (validation.warnings.length > 0) {
        logInfo('File validation warnings', { 
          fileName: file.name,
          warnings: validation.warnings 
        });
      }
    }

    await connectDB();

    // Step 2: Create file record in database
    logInfo('Creating file record', { fileName: file.name, botId });
    fileRecord = await createFileRecord(file, fileBuffer, botId, userId);

    // Step 3: Extract text content
    logInfo('Extracting text content', { fileName: file.name });
    const extractedText = await extractText(file, fileBuffer);

    // Validate extracted text
    const textValidation = validateTextContent(extractedText);
    if (!textValidation.isValid) {
      throw new FileError(`Text validation failed: ${textValidation.errors.join(', ')}`, 400);
    }

    // Step 4: Chunk text into documents
    logInfo('Chunking text content', { 
      fileName: file.name,
      textLength: extractedText.length,
      maxChunkSize,
      overlap
    });

    const metadata = {
      source: file.name,
      type: file.type,
      size: fileBuffer.length,
      fileId: fileRecord._id,
      botId,
      userId
    };

    documents = await chunkText(extractedText, metadata, {
      maxChunkSize,
      overlap,
      contentType: getContentType(file.type)
    });

    // Update file record with chunk info
    await updateFileRecord(fileRecord._id, {
      processingStatus: 'chunked',
      chunksCreated: documents.length,
      textLength: extractedText.length
    });

    logInfo('Text chunking completed', {
      fileName: file.name,
      chunksCreated: documents.length,
      avgChunkSize: Math.round(extractedText.length / documents.length)
    });

    // Step 5: Generate embeddings (if requested)
    let embeddingResults = null;
    if (generateEmbeddings) {
      logInfo('Generating embeddings', { 
        fileName: file.name,
        chunksCount: documents.length
      });

      embeddingResults = await generateAndStoreEmbeddings(
        documents,
        botId,
        userId,
        fileRecord._id
      );

      // Update file record with embedding info
      await updateFileRecord(fileRecord._id, {
        processingStatus: 'completed',
        embeddingStatus: 'completed',
        vectorsCreated: embeddingResults.vectorsCreated,
        tokensUsed: embeddingResults.tokensUsed,
        estimatedCost: embeddingResults.estimatedCost
      });
    } else {
      await updateFileRecord(fileRecord._id, {
        processingStatus: 'completed',
        embeddingStatus: 'skipped'
      });
    }

    const duration = timer.end({
      success: true,
      fileName: file.name,
      chunksCreated: documents.length,
      embeddingsGenerated: generateEmbeddings
    });

    logInfo('File processing completed successfully', {
      fileName: file.name,
      fileId: fileRecord._id,
      chunksCreated: documents.length,
      vectorsCreated: embeddingResults?.vectorsCreated || 0,
      duration: `${duration}ms`
    });

    return {
      success: true,
      file: fileRecord,
      chunksCreated: documents.length,
      vectorsCreated: embeddingResults?.vectorsCreated || 0,
      tokensUsed: embeddingResults?.tokensUsed || 0,
      estimatedCost: embeddingResults?.estimatedCost || 0,
      processingTime: duration
    };

  } catch (error) {
    timer.end({ success: false, error: error.message });

    // Update file record with error status
    if (fileRecord) {
      await updateFileRecord(fileRecord._id, {
        processingStatus: 'failed',
        embeddingStatus: 'failed',
        error: error.message
      }).catch(dbError => {
        logError('Failed to update file record with error status', {
          fileId: fileRecord._id,
          dbError: dbError.message
        });
      });
    }

    if (error instanceof FileError) {
      throw error;
    }

    logError('File processing failed', {
      fileName: file?.name,
      botId,
      userId,
      error: error.message
    });

    throw new FileError(`File processing failed: ${error.message}`, 500);
  }
}

/**
 * Create file record in database
 * @param {File} file - File object
 * @param {Buffer} fileBuffer - File content
 * @param {string} botId - Bot ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Created file record
 */
async function createFileRecord(file, fileBuffer, botId, userId) {
  try {
    const fileData = {
      userId,
      botId,
      filename: file.name,
      originalName: file.name,
      mimeType: file.type,
      size: fileBuffer.length,
      processingStatus: 'pending',
      embeddingStatus: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const fileRecord = await File.create(fileData);
    
    logInfo('File record created', {
      fileId: fileRecord._id,
      fileName: file.name,
      botId,
      userId
    });

    return fileRecord;
  } catch (error) {
    logError('Failed to create file record', {
      fileName: file.name,
      botId,
      userId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Update file record with processing results
 * @param {string} fileId - File ID
 * @param {Object} updates - Update data
 * @returns {Promise<Object>} Updated file record
 */
async function updateFileRecord(fileId, updates) {
  try {
    const updatedFile = await File.findByIdAndUpdate(
      fileId,
      { 
        ...updates,
        updatedAt: new Date()
      },
      { new: true }
    );

    return updatedFile;
  } catch (error) {
    logError('Failed to update file record', {
      fileId,
      updates,
      error: error.message
    });
    throw error;
  }
}

/**
 * Generate embeddings and store in vector database
 * @param {Array} documents - Document chunks
 * @param {string} botId - Bot ID
 * @param {string} userId - User ID
 * @param {string} fileId - File ID
 * @returns {Promise<Object>} Embedding results
 */
async function generateAndStoreEmbeddings(documents, botId, userId, fileId) {
  try {
    // Get bot-specific API key
    const keyData = await apiKeyService.getApiKey(botId, userId);
    
    // Extract text content from documents
    const texts = documents.map(doc => doc.pageContent);
    
    // Generate embeddings
    const embeddings = await generateEmbeddings(keyData.apiKey, texts, {
      model: keyData.models?.embeddings || 'text-embedding-3-small'
    });

    // Create embeddings instance for Qdrant storage
    const embeddingsInstance = createEmbeddingsInstance(keyData.apiKey, {
      model: keyData.models?.embeddings || 'text-embedding-3-small'
    });

    // Store in vector database
    const storeResults = await storeDocuments(
      botId, // Use botId as collection name
      embeddingsInstance,
      documents,
      {
        fileId,
        userId,
        embeddings: embeddings
      }
    );

    // Calculate token usage and cost estimation
    const totalTokens = documents.reduce((sum, doc) => {
      return sum + (doc.metadata.tokenCount || 0);
    }, 0);

    const estimatedCost = calculateEmbeddingCost(
      totalTokens,
      keyData.models?.embeddings || 'text-embedding-3-small'
    );

    return {
      vectorsCreated: storeResults.storedCount,
      tokensUsed: totalTokens,
      estimatedCost: estimatedCost,
      embeddingModel: keyData.models?.embeddings || 'text-embedding-3-small'
    };
  } catch (error) {
    logError('Failed to generate and store embeddings', {
      botId,
      userId,
      fileId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Get files for a specific bot
 * @param {string} botId - Bot ID
 * @param {string} userId - User ID for ownership validation
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Files list
 */
export async function getBotFiles(botId, userId, options = {}) {
  try {
    const {
      status = null,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    logInfo('Fetching bot files', { botId, userId, status, page, limit });

    await connectDB();

    // Build query
    const query = { botId, userId };

    if (status) {
      query.processingStatus = status;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query
    const [files, total] = await Promise.all([
      File.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      File.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    logInfo('Bot files retrieved', {
      botId,
      filesCount: files.length,
      totalFiles: total
    });

    return {
      success: true,
      data: {
        items: files,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    };
  } catch (error) {
    logError('Failed to fetch bot files', { botId, userId, error: error.message });
    throw new FileError(`Failed to fetch files: ${error.message}`, 500);
  }
}

/**
 * Delete file and associated vectors
 * @param {string} fileId - File ID
 * @param {string} userId - User ID for ownership validation
 * @returns {Promise<Object>} Deletion results
 */
export async function deleteFile(fileId, userId) {
  const timer = createPerformanceTimer('File Deletion');

  try {
    logInfo('Deleting file', { fileId, userId });

    await connectDB();

    // Get file record
    const file = await File.findOne({ _id: fileId, userId });

    if (!file) {
      throw new FileError('File not found or access denied', 404);
    }

    // TODO: Delete vectors from Qdrant
    // await deleteDocuments(file.botId, { fileId });

    // Delete file record
    await File.findByIdAndDelete(fileId);

    const duration = timer.end({ success: true, fileId });

    logInfo('File deleted successfully', {
      fileId,
      fileName: file.filename,
      botId: file.botId,
      duration: `${duration}ms`
    });

    return {
      success: true,
      data: {
        deletedFile: {
          id: fileId,
          name: file.filename
        }
      }
    };
  } catch (error) {
    timer.end({ success: false, error: error.message });

    if (error instanceof FileError) {
      throw error;
    }

    logError('File deletion failed', { fileId, userId, error: error.message });
    throw new FileError(`Failed to delete file: ${error.message}`, 500);
  }
}

/**
 * Get content type for chunking optimization
 * @param {string} mimeType - File MIME type
 * @returns {string} Content type for chunking
 */
function getContentType(mimeType) {
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('html')) return 'html';
  if (mimeType.includes('csv')) return 'csv';
  if (mimeType.includes('markdown')) return 'markdown';
  return 'text';
}

/**
 * Calculate estimated embedding cost
 * @param {number} tokens - Number of tokens
 * @param {string} model - Embedding model
 * @returns {number} Estimated cost in USD
 */
function calculateEmbeddingCost(tokens, model) {
  const pricing = {
    'text-embedding-3-small': 0.00002,
    'text-embedding-3-large': 0.00013,
    'text-embedding-ada-002': 0.0001
  };

  const costPer1K = pricing[model] || 0.00002;
  return (tokens / 1000) * costPer1K;
}

// Export default service object for compatibility
const fileService = {
  processFile,
  getBotFiles, 
  deleteFile
};

export default fileService;