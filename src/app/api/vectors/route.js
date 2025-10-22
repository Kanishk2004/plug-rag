import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import vectorStorageAPI from '@/lib/vectorStorage.js';
import qdrantAPI from '@/lib/qdrant.js';
import embeddingsAPI from '@/lib/embeddings.js';
import Bot from '@/models/Bot.js';
import connectMongo from '@/lib/mongo.js';

/**
 * GET /api/vectors/health - Health check for vector storage system
 */
export async function GET() {
  try {
    const health = await vectorStorageAPI.vectorStorageHealthCheck();
    
    return NextResponse.json(health, {
      status: health.success ? 200 : 503,
    });
    
  } catch (error) {
    console.error('Vector health check error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Health check failed',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vectors/search - Search for similar content
 * Body: { botId, query, limit?, scoreThreshold?, filter? }
 */
export async function POST(request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { botId, query, limit = 5, scoreThreshold = 0.7, filter = {} } = body;
    
    if (!botId || !query) {
      return NextResponse.json(
        { success: false, error: 'Bot ID and query are required' },
        { status: 400 }
      );
    }
    
    // Connect to MongoDB
    await connectMongo();
    
    // Verify bot ownership
    const bot = await Bot.findById(botId);
    if (!bot) {
      return NextResponse.json(
        { success: false, error: 'Bot not found' },
        { status: 404 }
      );
    }
    
    if (bot.ownerId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }
    
    // Search for similar content
    const searchResult = await vectorStorageAPI.searchSimilarContent(
      userId,
      botId,
      query,
      { limit, scoreThreshold, filter }
    );
    
    return NextResponse.json(searchResult);
    
  } catch (error) {
    console.error('Vector search error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Search failed',
        message: error.message,
      },
      { status: 500 }
    );
  }
}