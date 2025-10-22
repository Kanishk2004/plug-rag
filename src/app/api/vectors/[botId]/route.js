import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import vectorStorageAPI from '@/lib/vectorStorage.js';
import Bot from '@/models/Bot.js';
import connectMongo from '@/lib/mongo.js';

/**
 * GET /api/vectors/[botId] - Get vector storage statistics for a bot
 */
export async function GET(request, { params }) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const { botId } = params;
    
    if (!botId) {
      return NextResponse.json(
        { success: false, error: 'Bot ID is required' },
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
    
    // Get vector storage statistics
    const stats = await vectorStorageAPI.getBotVectorStats(userId, botId);
    
    return NextResponse.json(stats);
    
  } catch (error) {
    console.error('Error getting bot vector stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get vector statistics',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vectors/[botId] - Initialize vector storage for a bot
 */
export async function POST(request, { params }) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const { botId } = params;
    
    if (!botId) {
      return NextResponse.json(
        { success: false, error: 'Bot ID is required' },
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
    
    // Initialize vector storage
    const result = await vectorStorageAPI.initializeBotVectorStorage(userId, botId);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error initializing bot vector storage:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to initialize vector storage',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/vectors/[botId] - Clean up vector storage for a bot
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
    
    const { botId } = params;
    
    if (!botId) {
      return NextResponse.json(
        { success: false, error: 'Bot ID is required' },
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
    
    // Clean up vector storage
    const result = await vectorStorageAPI.cleanupBotVectorStorage(userId, botId);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error cleaning up bot vector storage:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to cleanup vector storage',
        message: error.message,
      },
      { status: 500 }
    );
  }
}