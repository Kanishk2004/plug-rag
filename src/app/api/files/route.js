import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import connectDB from '@/lib/mongo';
import File from '@/models/File';
import Bot from '@/models/Bot';
import { processFile, validateFile, getSupportedFileTypes } from '@/lib/extractors';
import { PerformanceMonitor } from '@/lib/performance';
import { getCurrentDBUser, updateUserUsage, checkUserLimits } from '@/lib/user';

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
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Connect to database
    await connectDB();

    // Get current user and check limits
    const user = await getCurrentDBUser();
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file');
    const botId = formData.get('botId');
    const options = JSON.parse(formData.get('options') || '{}');

    // Validate required fields
    if (!file || !botId) {
      return NextResponse.json(
        { error: 'File and botId are required' },
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

    // Validate file
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name;
    const mimeType = file.type;

    // Basic file validation
    const validation = validateFile(fileBuffer, filename, {
      maxFileSize: MAX_FILE_SIZE,
      allowedTypes: Object.keys(getSupportedFileTypes()).map(t => t.toLowerCase()),
    });

    if (!validation.isValid) {
      return NextResponse.json(
        { error: 'File validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    // MIME type validation
    if (!ALLOWED_MIME_TYPES.includes(mimeType) && mimeType !== '') {
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
      maxChunkSize: options.maxChunkSize || 700,
      overlap: options.overlap || 100,
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
    const { userId } = auth();
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