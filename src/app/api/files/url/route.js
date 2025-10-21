import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import connectDB from '@/lib/mongo';
import File from '@/models/File';
import Bot from '@/models/Bot';
import Chunk from '@/models/Chunk';
import { processURL, validateFile } from '@/lib/extractors';
import { PerformanceMonitor } from '@/lib/performance';
import { getCurrentDBUser, updateUserUsage, checkUserLimits } from '@/lib/user';

export async function POST(request) {
  try {
    PerformanceMonitor.startTimer('url-processing-api');
    
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { url, botId, options = {} } = body;

    // Validate required fields
    if (!url || !botId) {
      return NextResponse.json(
        { error: 'URL and botId are required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    await connectDB();

    // Get current user and check limits
    const user = await getCurrentDBUser();
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
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

    // Check if URL already exists for this bot
    const existingFile = await File.findOne({
      botId,
      'metadata.url': url,
      status: { $ne: 'deleted' }
    });

    if (existingFile) {
      return NextResponse.json(
        { error: 'URL already processed for this bot' },
        { status: 409 }
      );
    }

    // Process URL with extractors
    PerformanceMonitor.startTimer('url-extraction');
    
    const processingOptions = {
      timeout: options.timeout || 30000,
      maxContentLength: options.maxContentLength || 1000000,
      maxChunkSize: options.maxChunkSize || 700,
      overlap: options.overlap || 100,
      respectStructure: options.respectStructure !== false,
      extractLinks: options.extractLinks || false,
      ...options,
    };

    const extractedData = await processURL(url, processingOptions);
    
    PerformanceMonitor.endTimer('url-extraction');

    // Generate filename from URL
    const urlObj = new URL(url);
    const filename = generateFilenameFromURL(urlObj);

    // Estimate content size
    const contentSize = Buffer.byteLength(extractedData.text, 'utf8');

    // Create file record in database
    const fileRecord = new File({
      botId,
      ownerId: userId,
      filename: filename,
      originalName: url,
      mimeType: 'text/html',
      fileType: 'html',
      size: contentSize,
      status: 'completed',
      extractedText: extractedData.text,
      totalChunks: extractedData.chunks.length,
      totalTokens: extractedData.wordCount,
      embeddingStatus: 'pending',
      vectorCount: 0,
      metadata: {
        ...extractedData.metadata,
        url: url,
        isWebContent: true,
        processingOptions,
      },
      processedAt: new Date(),
    });

    await fileRecord.save();

    // Create chunk records
    const chunkRecords = extractedData.chunks.map((chunk, index) => ({
      fileId: fileRecord._id,
      botId,
      ownerId: userId,
      content: chunk.content,
      chunkIndex: index,
      tokens: chunk.tokens,
      startOffset: 0,
      endOffset: chunk.content.length,
      embeddingStatus: 'pending',
      metadata: {
        type: chunk.type,
        hasOverlap: chunk.hasOverlap,
        sourceFileType: 'html',
        sourceURL: url,
        heading: chunk.heading,
        level: chunk.level,
      },
    }));

    if (chunkRecords.length > 0) {
      await Chunk.insertMany(chunkRecords);
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
      'usage.storageUsed': contentSize,
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
        url: url,
      },
      extraction: {
        title: extractedData.metadata.title,
        description: extractedData.metadata.description,
        wordCount: extractedData.wordCount,
        characterCount: extractedData.characterCount,
        chunks: extractedData.chunks.slice(0, 5).map(chunk => ({ // Show first 5 chunks
          id: chunk.id,
          content: chunk.content.substring(0, 200) + '...',
          tokens: chunk.tokens,
          type: chunk.type,
          chunkIndex: chunk.chunkIndex,
        })),
        structure: {
          headings: extractedData.structure?.headings?.slice(0, 10) || [],
          totalParagraphs: extractedData.structure?.paragraphs?.length || 0,
          totalLists: extractedData.structure?.lists?.length || 0,
          totalTables: extractedData.structure?.tables?.length || 0,
        },
        links: extractedData.links?.slice(0, 20) || [], // Show first 20 links
        metadata: extractedData.metadata,
      },
      processing: extractedData.processing,
    };

    PerformanceMonitor.endTimer('url-processing-api');
    
    return NextResponse.json(responseData, { status: 201 });

  } catch (error) {
    PerformanceMonitor.endTimer('url-processing-api', 'error');
    console.error('URL processing API error:', error);

    // Handle specific error types
    if (error.message.includes('timeout')) {
      return NextResponse.json(
        { error: 'URL request timeout' },
        { status: 408 }
      );
    }

    if (error.message.includes('HTTP')) {
      return NextResponse.json(
        { error: 'Failed to fetch URL', details: error.message },
        { status: 502 }
      );
    }

    if (error.message.includes('Invalid URL')) {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
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

/**
 * Generate filename from URL
 */
function generateFilenameFromURL(urlObj) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  
  // Extract meaningful part from URL
  let name = urlObj.pathname.split('/').pop() || urlObj.hostname;
  
  // Clean up the name
  name = name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 50);
  
  if (!name || name === '_') {
    name = urlObj.hostname.replace(/[^a-zA-Z0-9.-]/g, '_');
  }
  
  return `${name}_${timestamp}_${random}.html`;
}