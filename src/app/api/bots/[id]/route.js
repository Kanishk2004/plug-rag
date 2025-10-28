import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import connectDB from '@/lib/mongo';
import Bot from '@/models/Bot';
import File from '@/models/File';

/**
 * GET /api/bots/[id] - Get individual bot details
 */
export async function GET(request, { params }) {
  try {
    // Authentication check
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: botId } = await params;
    if (!botId) {
      return NextResponse.json({ error: 'Bot ID is required' }, { status: 400 });
    }

    // Connect to database
    await connectDB();

    // Get bot details
    const bot = await Bot.findOne({ _id: botId, ownerId: userId }).lean();
    
    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    // Get file count and recent files
    const [fileCount, recentFiles] = await Promise.all([
      File.countDocuments({ botId, ownerId: userId }),
      File.find({ botId, ownerId: userId })
        .select('filename originalName fileType size status embeddingStatus createdAt')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean()
    ]);

    // Format response
    const responseData = {
      success: true,
      bot: {
        id: bot._id,
        name: bot.name,
        description: bot.description,
        botKey: bot.botKey,
        status: bot.status,
        customization: bot.customization,
        fileCount,
        totalTokens: bot.totalTokens,
        analytics: bot.analytics,
        vectorStorage: {
          enabled: bot.vectorStorage?.enabled || false,
          provider: bot.vectorStorage?.provider,
          model: bot.vectorStorage?.model,
        },
        limits: bot.limits,
        createdAt: bot.createdAt,
        updatedAt: bot.updatedAt,
        recentFiles: recentFiles.map(file => ({
          id: file._id,
          filename: file.filename,
          originalName: file.originalName,
          fileType: file.fileType,
          size: file.size,
          status: file.status,
          embeddingStatus: file.embeddingStatus,
          createdAt: file.createdAt,
        }))
      }
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Get bot API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/bots/[id] - Update bot details
 */
export async function PATCH(request, { params }) {
  try {
    // Authentication check
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: botId } = await params;
    if (!botId) {
      return NextResponse.json({ error: 'Bot ID is required' }, { status: 400 });
    }

    // Parse request body
    const body = await request.json();
    const allowedUpdates = ['name', 'description', 'status', 'customization'];
    const updates = {};

    // Validate and sanitize updates
    for (const key of allowedUpdates) {
      if (body[key] !== undefined) {
        if (key === 'name') {
          if (!body[key] || body[key].length < 2 || body[key].length > 50) {
            return NextResponse.json(
              { error: 'Bot name must be between 2 and 50 characters' },
              { status: 400 }
            );
          }
          updates[key] = body[key].trim();
        } else if (key === 'description') {
          if (body[key] && body[key].length > 500) {
            return NextResponse.json(
              { error: 'Description must be less than 500 characters' },
              { status: 400 }
            );
          }
          updates[key] = body[key]?.trim() || '';
        } else if (key === 'status') {
          if (!['active', 'inactive'].includes(body[key])) {
            return NextResponse.json(
              { error: 'Status must be either active or inactive' },
              { status: 400 }
            );
          }
          updates[key] = body[key];
        } else if (key === 'customization') {
          updates[key] = validateCustomization(body[key]);
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid updates provided' },
        { status: 400 }
      );
    }

    // Connect to database
    await connectDB();

    // Update bot
    const bot = await Bot.findOneAndUpdate(
      { _id: botId, ownerId: userId },
      { 
        ...updates,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    ).lean();

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    // Format response
    const responseData = {
      success: true,
      bot: {
        id: bot._id,
        name: bot.name,
        description: bot.description,
        botKey: bot.botKey,
        status: bot.status,
        customization: bot.customization,
        fileCount: bot.fileCount,
        totalTokens: bot.totalTokens,
        analytics: bot.analytics,
        createdAt: bot.createdAt,
        updatedAt: bot.updatedAt,
      },
      message: 'Bot updated successfully'
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Update bot API error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(
        (err) => err.message
      );
      return NextResponse.json(
        { error: 'Validation failed', details: validationErrors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/bots/[id] - Delete bot
 */
export async function DELETE(request, { params }) {
  try {
    // Authentication check
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: botId } = await params;
    if (!botId) {
      return NextResponse.json({ error: 'Bot ID is required' }, { status: 400 });
    }

    // Connect to database
    await connectDB();

    // Check if bot exists and belongs to user
    const bot = await Bot.findOne({ _id: botId, ownerId: userId });
    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    // Delete associated files and chunks
    await File.deleteMany({ botId, ownerId: userId });
    
    // Note: We would also clean up vectors from Qdrant here
    // but since vector storage is temporarily disabled, we'll skip this
    
    // Delete the bot
    await Bot.findByIdAndDelete(botId);

    return NextResponse.json({
      success: true,
      message: 'Bot deleted successfully'
    });
  } catch (error) {
    console.error('Delete bot API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Validate and sanitize customization options
 */
function validateCustomization(customization) {
  const defaults = {
    bubbleColor: '#f97316',
    position: 'bottom-right',
    greeting: 'Hello! How can I help you today?',
    placeholder: 'Type your message...',
    title: 'Chat Assistant',
  };

  if (!customization || typeof customization !== 'object') {
    return defaults;
  }

  const validated = { ...defaults };

  // Validate bubble color (hex format)
  if (
    customization.bubbleColor &&
    /^#[0-9A-F]{6}$/i.test(customization.bubbleColor)
  ) {
    validated.bubbleColor = customization.bubbleColor;
  }

  // Validate position
  const validPositions = [
    'bottom-right',
    'bottom-left',
    'top-right',
    'top-left',
  ];
  if (
    customization.position &&
    validPositions.includes(customization.position)
  ) {
    validated.position = customization.position;
  }

  // Validate text fields with length limits
  if (customization.greeting && customization.greeting.length <= 200) {
    validated.greeting = customization.greeting.trim();
  }

  if (customization.placeholder && customization.placeholder.length <= 100) {
    validated.placeholder = customization.placeholder.trim();
  }

  if (customization.title && customization.title.length <= 50) {
    validated.title = customization.title.trim();
  }

  return validated;
}