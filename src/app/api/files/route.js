import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongo';
import File from '@/models/File';
import Bot from '@/models/Bot';
import Chunk from '@/models/Chunk';
import { processFile, validateFile, getSupportedFileTypes } from '@/lib/extractors';
import { PerformanceMonitor } from '@/lib/performance';
import { getCurrentDBUser, updateUserUsage, checkUserLimits } from '@/lib/user';
import { initializeBotVectorStorage, processFileToVectors } from '@/lib/vectorStorage.js';

// Configuration
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'text/csv',
  'text/html',
];

export async function POST(request) {
  try {
    PerformanceMonitor.startTimer('file-upload-api');
    
    // Authentication check
    let userId;
    
    try {
      const authResult = await auth();
      userId = authResult?.userId;
    } catch (authError) {
      console.log('Auth function error:', authError);
    }
    
    // Fallback to currentUser if auth() doesn't work
    if (!userId) {
      try {
        const user = await currentUser();
        userId = user?.id;
      } catch (userError) {
        console.log('CurrentUser error:', userError);
      }
    }
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in to upload files' },
        { status: 401 }
      );
    }

    // Connect to database
    await connectDB();

    // Get current user and check limits
    const user = await getCurrentDBUser(userId);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file');
    const botIdString = formData.get('botId');
    const options = JSON.parse(formData.get('options') || '{}');

    // Validate required fields
    if (!file || !botIdString) {
      return NextResponse.json(
        { error: 'File and botId are required' },
        { status: 400 }
      );
    }

    console.log('[FILE-UPLOAD] Processing request', {
      fileName: file?.name,
      botId: botIdString,
      userId,
      fileSize: file?.size
    });

    // Convert botId to ObjectId for proper database operations
    let botId;
    try {
      botId = new mongoose.Types.ObjectId(botIdString);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid botId format' },
        { status: 400 }
      );
    }

    // Validate bot ownership
    const bot = await Bot.findOne({ _id: botId, ownerId: userId });
    if (!bot) {
      return NextResponse.json(
        { error: 'Bot not found or access denied' },
        { status: 404 }
      );
    }

    // Check user limits
    const { limits, hasReachedAnyLimit } = await checkUserLimits(userId);
    if (limits.botsReached || limits.storageReached) {
      return NextResponse.json(
        { error: 'Plan limits reached', limits },
        { status: 429 }
      );
    }

    // Validate file object
    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { error: 'Invalid file upload. Please select a valid file.' },
        { status: 400 }
      );
    }

    console.log('[FILE-UPLOAD] Processing file upload', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      botId
    });

    // Convert file to buffer
    let fileBuffer;
    try {
      // Try using arrayBuffer() method
      if (typeof file.arrayBuffer === 'function') {
        const arrayBuffer = await file.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
      } else if (typeof file.stream === 'function') {
        // Alternative method using stream
        const chunks = [];
        const reader = file.stream().getReader();
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        
        fileBuffer = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
      } else {
        throw new Error('Unable to read file data');
      }
    } catch (bufferError) {
      console.error('[FILE-UPLOAD] Error converting file to buffer:', bufferError);
      return NextResponse.json(
        { error: 'Failed to process file data', details: bufferError.message },
        { status: 400 }
      );
    }

    const filename = file.name;
    const mimeType = file.type;

    console.log('[FILE-UPLOAD] File buffer created successfully', {
      bufferSize: fileBuffer.length,
      expectedSize: file.size,
      fileName: filename,
      mimeType
    });

    // Verify buffer size matches file size
    if (fileBuffer.length !== file.size) {
      console.warn('[FILE-UPLOAD] Buffer size mismatch', {
        bufferSize: fileBuffer.length,
        fileSize: file.size
      });
    }

    // Basic file validation
    console.log('[FILE-UPLOAD] Starting file validation');
    const validation = validateFile(fileBuffer, filename, {
      maxFileSize: MAX_FILE_SIZE,
      allowedTypes: Object.keys(getSupportedFileTypes()).map(t => t.toLowerCase()),
    });

    if (!validation.isValid) {
      console.error('[FILE-UPLOAD] File validation failed', {
        fileName: filename,
        errors: validation.errors,
        fileSize: fileBuffer.length,
        mimeType
      });
      return NextResponse.json(
        { error: 'File validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    console.log('[FILE-UPLOAD] File validation passed');

    // MIME type validation
    if (!ALLOWED_MIME_TYPES.includes(mimeType) && mimeType !== '') {
      console.error('[FILE-UPLOAD] Unsupported MIME type', {
        fileName: filename,
        mimeType,
        allowedTypes: ALLOWED_MIME_TYPES
      });
      return NextResponse.json(
        { error: `Unsupported file type: ${mimeType}` },
        { status: 400 }
      );
    }

    // Check if file already exists for this bot
    const existingFile = await File.findOne({
      botId,
      originalName: filename,
      status: { $ne: 'deleted' }
    });

    if (existingFile) {
      return NextResponse.json(
        { error: 'File with this name already exists for this bot' },
        { status: 409 }
      );
    }

    // Process file with extractors
    PerformanceMonitor.startTimer('file-processing');
    
    const processingOptions = {
      maxChunkSize: options.maxChunkSize || 500, // Reduced from 700
      overlap: options.overlap || 50, // Reduced from 100
      maxTokens: options.maxTokens || 6000, // Added token limit
      respectStructure: options.respectStructure !== false,
      ...options,
    };

    const extractedData = await processFile(fileBuffer, filename, processingOptions);
    
    PerformanceMonitor.endTimer('file-processing');

    // Create file record in database
    const fileRecord = new File({
      botId,
      ownerId: userId,
      filename: generateUniqueFilename(filename),
      originalName: filename,
      mimeType: mimeType || 'application/octet-stream',
      fileType: validation.detectedType,
      size: fileBuffer.length,
      status: 'completed',
      extractedText: extractedData.text,
      totalChunks: extractedData.chunks.length,
      totalTokens: extractedData.wordCount, // Approximate tokens
      embeddingStatus: 'pending',
      vectorCount: 0,
      metadata: {
        ...extractedData.metadata,
        processingOptions,
      },
      processedAt: new Date(),
    });

    await fileRecord.save();

    // Save chunks to database
    if (extractedData.chunks && extractedData.chunks.length > 0) {
      try {
        const chunkDocuments = extractedData.chunks.map((chunk, index) => ({
          fileId: fileRecord._id,
          botId,
          ownerId: userId,
          content: chunk.content,
          chunkIndex: chunk.chunkIndex !== undefined ? chunk.chunkIndex : index,
          tokens: chunk.tokens || Math.ceil(chunk.content.length / 4),
          type: mapChunkType(chunk.type || 'paragraph_boundary'),
          metadata: chunk.metadata || {},
          embeddingStatus: 'pending',
        }));

        await Chunk.insertMany(chunkDocuments);
        console.log(`✅ Saved ${chunkDocuments.length} chunks for file: ${filename}`);
      } catch (chunkError) {
        console.error('Error saving chunks:', chunkError);
        // Don't fail the entire request if chunk saving fails
        // Just log the error and continue
      }
    } else {
      console.warn(`⚠️ No chunks generated for file: ${filename}`);
    }

    // Update bot statistics
    await Bot.findByIdAndUpdate(botId, {
      $inc: {
        fileCount: 1,
        totalTokens: extractedData.wordCount,
      },
    });

    // Update user usage
    await updateUserUsage(userId, {
      'usage.storageUsed': fileBuffer.length,
    });

    // Prepare response data
    const responseData = {
      success: true,
      file: {
        id: fileRecord._id,
        filename: fileRecord.filename,
        originalName: fileRecord.originalName,
        fileType: fileRecord.fileType,
        size: fileRecord.size,
        status: fileRecord.status,
        totalChunks: fileRecord.totalChunks,
        totalTokens: fileRecord.totalTokens,
        embeddingStatus: fileRecord.embeddingStatus,
        processedAt: fileRecord.processedAt,
      },
      extraction: {
        wordCount: extractedData.wordCount,
        characterCount: extractedData.characterCount,
        chunks: extractedData.chunks.map(chunk => ({
          id: chunk.id,
          content: chunk.content.substring(0, 200) + '...', // Preview only
          tokens: chunk.tokens,
          type: chunk.type,
          chunkIndex: chunk.chunkIndex,
        })),
        metadata: extractedData.metadata,
      },
      processing: extractedData.processing,
    };

    // Optional: Generate embeddings immediately if requested
    if (options.generateEmbeddings === true) {
      try {
        console.log('Generating embeddings for file:', fileRecord.originalName);
        
        // Initialize vector storage for bot if needed
        await initializeBotVectorStorage(userId, botId);

        // Process file to vectors
        const vectorResult = await processFileToVectors(
          userId,
          botId.toString(), // Convert ObjectId to string for consistency
          fileRecord._id.toString()
        );
        
        responseData.vectorProcessing = {
          success: true,
          vectorsStored: vectorResult.vectorsStored,
          tokensUsed: vectorResult.tokensUsed,
          collectionName: vectorResult.collectionName,
        };
        
        // Update response with new embedding status
        responseData.file.embeddingStatus = 'completed';
        responseData.file.vectorCount = vectorResult.vectorsStored;
        
      } catch (embedError) {
        console.error('Error generating embeddings:', embedError);
        
        // Don't fail the entire request if embedding fails
        responseData.vectorProcessing = {
          success: false,
          error: embedError.message,
          message: 'File processed successfully, but embedding generation failed',
        };
      }
    }

    PerformanceMonitor.endTimer('file-upload-api');
    
    return NextResponse.json(responseData, { status: 201 });

  } catch (error) {
    PerformanceMonitor.endTimer('file-upload-api', 'error');
    console.error('File upload API error:', error);

    // Handle specific error types
    if (error.message.includes('File size')) {
      return NextResponse.json(
        { error: 'File too large', maxSize: `${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 413 }
      );
    }

    if (error.message.includes('Unsupported file type')) {
      return NextResponse.json(
        { error: error.message, supportedTypes: getSupportedFileTypes() },
        { status: 415 }
      );
    }

    if (error.message.includes('timeout')) {
      return NextResponse.json(
        { error: 'File processing timeout' },
        { status: 408 }
      );
    }

    // Generic error response
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const botId = url.searchParams.get('botId');

    if (!botId) {
      return NextResponse.json(
        { error: 'botId is required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Validate bot ownership
    const bot = await Bot.findOne({ _id: botId, ownerId: userId });
    if (!bot) {
      return NextResponse.json(
        { error: 'Bot not found or access denied' },
        { status: 404 }
      );
    }

    // Get files for this bot
    const files = await File.find({
      botId,
      status: { $ne: 'deleted' }
    })
    .select('-extractedText') // Exclude large text content
    .sort({ createdAt: -1 })
    .limit(100);

    const responseData = {
      success: true,
      files: files.map(file => ({
        id: file._id,
        filename: file.filename,
        originalName: file.originalName,
        fileType: file.fileType,
        size: file.size,
        status: file.status,
        totalChunks: file.totalChunks,
        totalTokens: file.totalTokens,
        embeddingStatus: file.embeddingStatus,
        vectorCount: file.vectorCount,
        createdAt: file.createdAt,
        processedAt: file.processedAt,
      })),
      total: files.length,
      bot: {
        id: bot._id,
        name: bot.name,
        fileCount: bot.fileCount,
        totalTokens: bot.totalTokens,
      },
    };

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Get files API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const fileId = url.searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json(
        { error: 'fileId is required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Find and validate file
    const file = await File.findOne({ _id: fileId, ownerId: userId });
    if (!file) {
      return NextResponse.json(
        { error: 'File not found or access denied' },
        { status: 404 }
      );
    }

    // Mark file as deleted
    await File.findByIdAndUpdate(fileId, {
      status: 'deleted',
      deletedAt: new Date(),
    });

    // Update bot statistics
    await Bot.findByIdAndUpdate(file.botId, {
      $inc: {
        fileCount: -1,
        totalTokens: -file.totalTokens,
      },
    });

    // Update user usage
    await updateUserUsage(userId, {
      'usage.storageUsed': -file.size,
    });

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully',
    });

  } catch (error) {
    console.error('Delete file API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Generate unique filename to prevent conflicts
 */
function generateUniqueFilename(originalFilename) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const extension = originalFilename.split('.').pop();
  const nameWithoutExt = originalFilename.replace(/\.[^/.]+$/, '');
  
  return `${nameWithoutExt}_${timestamp}_${random}.${extension}`;
}

/**
 * Map chunk types from extractors to valid Chunk model enum values
 */
function mapChunkType(extractorType) {
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