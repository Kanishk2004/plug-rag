import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import connectDB from '@/lib/mongo';
import File from '@/models/File.js';
import Bot from '@/models/Bot.js';
import mongoose from 'mongoose';

/**
 * GET /api/files/info?botId=<botId> - Get file info for a bot
 */
export async function GET(request) {
  try {
    // Authentication check
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Connect to database
    await connectDB();

    // Get botId from query params
    const { searchParams } = new URL(request.url);
    const botIdString = searchParams.get('botId');

    if (!botIdString) {
      return NextResponse.json(
        { error: 'botId query parameter is required' },
        { status: 400 }
      );
    }

    let botId;
    try {
      botId = new mongoose.Types.ObjectId(botIdString);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid botId format' },
        { status: 400 }
      );
    }

    // Verify bot ownership
    const bot = await Bot.findOne({ _id: botId, ownerId: userId });
    if (!bot) {
      return NextResponse.json(
        { error: 'Bot not found or access denied' },
        { status: 404 }
      );
    }

    // Get files for this bot
    const files = await File.find({ botId, ownerId: userId })
      .select('filename originalName fileType size status embeddingStatus totalChunks vectorCount createdAt processedAt')
      .sort({ createdAt: -1 });

    // Get summary statistics
    const stats = await File.aggregate([
      { $match: { botId: botId, ownerId: userId } },
      {
        $group: {
          _id: null,
          totalFiles: { $sum: 1 },
          completedFiles: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          totalChunks: { $sum: '$totalChunks' },
          totalVectors: { $sum: '$vectorCount' },
          totalSize: { $sum: '$size' }
        }
      }
    ]);

    return NextResponse.json({
      success: true,
      files,
      stats: stats[0] || {
        totalFiles: 0,
        completedFiles: 0,
        totalChunks: 0,
        totalVectors: 0,
        totalSize: 0
      }
    });
  } catch (error) {
    console.error('File info API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}