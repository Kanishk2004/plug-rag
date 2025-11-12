import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import vectorStorageAPI from '@/lib/vectorStorage.js';
import Bot from '@/models/Bot.js';
import File from '@/models/File.js';
import connectMongo from '@/lib/mongo.js';

/**
 * POST /api/vectors/process/[fileId] - Process a file to generate and store vectors
 */
export async function POST(request, { params }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const { fileId } = await params;
    
    if (!fileId) {
      return NextResponse.json(
        { success: false, error: 'File ID is required' },
        { status: 400 }
      );
    }
    
    // Connect to MongoDB
    await connectMongo();
    
    // Get file and verify ownership
    const file = await File.findById(fileId);
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404 }
      );
    }
    
    if (file.ownerId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }
    
    // Verify bot ownership
    const bot = await Bot.findById(file.botId);
    if (!bot || bot.ownerId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Bot not found or unauthorized' },
        { status: 403 }
      );
    }
    
    // Check if file is ready for processing
    if (file.status !== 'completed') {
      return NextResponse.json(
        { success: false, error: 'File must be processed before generating embeddings' },
        { status: 400 }
      );
    }
    
    if (file.embeddingStatus === 'completed') {
      return NextResponse.json(
        { success: false, error: 'File already has embeddings generated' },
        { status: 400 }
      );
    }
    
    // Update file status to processing
    await File.findByIdAndUpdate(fileId, {
      embeddingStatus: 'processing',
    });
    
    try {
      // Initialize vector storage for bot if not already done
      await vectorStorageAPI.initializeBotVectorStorage(userId, file.botId.toString());
      
      // Process file to vectors
      const result = await vectorStorageAPI.processFileToVectors(
        userId,
        file.botId.toString(),
        fileId
      );
      
      return NextResponse.json(result);
      
    } catch (processingError) {
      // Update file status to failed
      await File.findByIdAndUpdate(fileId, {
        embeddingStatus: 'failed',
        processingError: processingError.message,
      });
      
      throw processingError;
    }
    
  } catch (error) {
    console.error('Error processing file to vectors:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process file to vectors',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/vectors/process/[fileId] - Delete vectors for a file
 */
export async function DELETE(request, { params }) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const { fileId } = params;
    
    if (!fileId) {
      return NextResponse.json(
        { success: false, error: 'File ID is required' },
        { status: 400 }
      );
    }
    
    // Connect to MongoDB
    await connectMongo();
    
    // Get file and verify ownership
    const file = await File.findById(fileId);
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404 }
      );
    }
    
    if (file.ownerId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }
    
    // Verify bot ownership
    const bot = await Bot.findById(file.botId);
    if (!bot || bot.ownerId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Bot not found or unauthorized' },
        { status: 403 }
      );
    }
    
    // Delete file vectors
    const result = await vectorStorageAPI.deleteFileVectors(
      userId,
      file.botId.toString(),
      fileId
    );
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error deleting file vectors:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete file vectors',
        message: error.message,
      },
      { status: 500 }
    );
  }
}