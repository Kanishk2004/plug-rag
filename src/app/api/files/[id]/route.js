import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import connectDB from '@/lib/mongo';
import File from '@/models/File';
import Chunk from '@/models/Chunk';
import { processFile } from '@/lib/extractors';
import { PerformanceMonitor } from '@/lib/performance';

export async function POST(request, { params }) {
  try {
    PerformanceMonitor.startTimer('file-reprocessing');
    
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const fileId = (await params).id;
    const body = await request.json();
    const { options = {} } = body;

    await connectDB();

    // Find and validate file
    const file = await File.findOne({ _id: fileId, ownerId: userId });
    if (!file) {
      return NextResponse.json(
        { error: 'File not found or access denied' },
        { status: 404 }
      );
    }

    if (file.status !== 'completed') {
      return NextResponse.json(
        { error: 'File is not in completed status' },
        { status: 400 }
      );
    }

    // If we have the original file data, reprocess it
    if (!file.extractedText) {
      return NextResponse.json(
        { error: 'Original file data not available for reprocessing' },
        { status: 400 }
      );
    }

    // Reprocess with new options
    const processingOptions = {
      maxChunkSize: options.maxChunkSize || 700,
      overlap: options.overlap || 100,
      respectStructure: options.respectStructure !== false,
      ...options,
    };

    // Create chunks from existing extracted text
    const { chunkText } = await import('@/lib/extractors');
    const chunks = chunkText(file.extractedText, { metadata: file.metadata }, processingOptions);

    // Update file record
    await File.findByIdAndUpdate(fileId, {
      totalChunks: chunks.length,
      'metadata.processingOptions': processingOptions,
      embeddingStatus: 'pending', // Reset embedding status
      processedAt: new Date(),
    });

    // Delete existing chunks
    await Chunk.deleteMany({ fileId });

    // Create new chunk records
    const chunkRecords = chunks.map((chunk, index) => ({
      fileId,
      botId: file.botId,
      ownerId: userId,
      content: chunk.content,
      chunkIndex: index,
      tokens: chunk.tokens,
      startOffset: 0, // Would need to calculate from original text
      endOffset: chunk.content.length,
      embeddingStatus: 'pending',
      metadata: {
        type: chunk.type,
        hasOverlap: chunk.hasOverlap,
        sourceFileType: file.fileType,
      },
    }));

    await Chunk.insertMany(chunkRecords);

    const responseData = {
      success: true,
      file: {
        id: file._id,
        totalChunks: chunks.length,
        embeddingStatus: 'pending',
        processedAt: new Date(),
      },
      chunks: chunks.map((chunk, index) => ({
        id: chunkRecords[index]._id,
        content: chunk.content.substring(0, 200) + '...',
        tokens: chunk.tokens,
        type: chunk.type,
        chunkIndex: index,
      })),
      processingOptions,
    };

    PerformanceMonitor.endTimer('file-reprocessing');
    return NextResponse.json(responseData);

  } catch (error) {
    PerformanceMonitor.endTimer('file-reprocessing', 'error');
    console.error('File reprocessing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request, { params }) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const fileId = params.id;
    const url = new URL(request.url);
    const includeChunks = url.searchParams.get('includeChunks') === 'true';
    const includeText = url.searchParams.get('includeText') === 'true';

    await connectDB();

    // Find file
    const file = await File.findOne({ _id: fileId, ownerId: userId });
    if (!file) {
      return NextResponse.json(
        { error: 'File not found or access denied' },
        { status: 404 }
      );
    }

    const responseData = {
      success: true,
      file: {
        id: file._id,
        filename: file.filename,
        originalName: file.originalName,
        fileType: file.fileType,
        mimeType: file.mimeType,
        size: file.size,
        status: file.status,
        totalChunks: file.totalChunks,
        totalTokens: file.totalTokens,
        embeddingStatus: file.embeddingStatus,
        vectorCount: file.vectorCount,
        metadata: file.metadata,
        createdAt: file.createdAt,
        processedAt: file.processedAt,
      },
    };

    // Include extracted text if requested
    if (includeText) {
      responseData.file.extractedText = file.extractedText;
    }

    // Include chunks if requested
    if (includeChunks) {
      const chunks = await Chunk.find({ fileId })
        .sort({ chunkIndex: 1 })
        .limit(100); // Limit to prevent large responses

      responseData.chunks = chunks.map(chunk => ({
        id: chunk._id,
        content: chunk.content,
        chunkIndex: chunk.chunkIndex,
        tokens: chunk.tokens,
        embeddingStatus: chunk.embeddingStatus,
        vectorId: chunk.vectorId,
        metadata: chunk.metadata,
      }));
    }

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Get file details error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}