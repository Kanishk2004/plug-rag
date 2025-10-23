import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import connectDB from '@/lib/mongo';
import Bot from '@/models/Bot';
import { getCurrentDBUser, updateUserUsage, checkUserLimits, syncUserWithDB } from '@/lib/user';
import { PerformanceMonitor } from '@/lib/performance';
import vectorStorageAPI from '@/lib/vectorStorage.js';

/**
 * POST /api/bots - Create a new bot
 */
export async function POST(request) {
  try {
    PerformanceMonitor.startTimer('bot-creation-api');
    
    // Authentication check - using the working method
    let userId;
    
    try {
      // Try auth() synchronously first
      const authResult = auth();
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
        { error: 'Unauthorized - Please log in to create a bot' },
        { status: 401 }
      );
    }

    // Connect to database
    await connectDB();

    // Get current user and check limits
    let user = await getCurrentDBUser(userId);
    if (!user) {
      // User doesn't exist in DB, sync them first
      console.log('User not found in DB, creating user...');
      user = await syncUserWithDB(userId);
      if (!user) {
        return NextResponse.json(
          { error: 'Failed to create user record' },
          { status: 500 }
        );
      }
    }

    // Check user limits
    const { limits, hasReachedAnyLimit } = await checkUserLimits(userId);
    if (limits.botsReached) {
      return NextResponse.json(
        { 
          error: 'Bot limit reached', 
          limits,
          message: `You have reached the maximum number of bots allowed for your plan.`
        },
        { status: 429 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { name, description, customization = {} } = body;

    // Validate required fields
    if (!name || !description) {
      return NextResponse.json(
        { error: 'Name and description are required' },
        { status: 400 }
      );
    }

    // Validate name length and format
    if (name.length < 2 || name.length > 50) {
      return NextResponse.json(
        { error: 'Bot name must be between 2 and 50 characters' },
        { status: 400 }
      );
    }

    // Validate description length
    if (description.length > 500) {
      return NextResponse.json(
        { error: 'Description must be less than 500 characters' },
        { status: 400 }
      );
    }

    // Generate unique bot key
    const botKey = generateBotKey();

    // Validate customization options
    const validatedCustomization = validateCustomization(customization);

    // Create bot record
    const bot = new Bot({
      ownerId: userId,
      name: name.trim(),
      description: description.trim(),
      botKey,
      customization: validatedCustomization,
      status: 'active',
      vectorStorage: {
        enabled: false,
        provider: 'qdrant',
        dimensions: 1536,
        model: 'text-embedding-3-small',
      },
      analytics: {
        totalMessages: 0,
        totalSessions: 0,
        totalEmbeddings: 0,
        totalTokensUsed: 0,
        lastActiveAt: new Date(),
      },
      limits: {
        maxFilesPerBot: user.plan.maxFilesPerBot || 10,
        maxFileSize: user.plan.maxFileSize || 10485760, // 10MB
        messagesPerMonth: user.plan.messagesPerMonth || 1000,
      },
      fileCount: 0,
      totalTokens: 0,
      isEmbeddingComplete: true,
    });

    await bot.save();

    // Update user usage
    await updateUserUsage(userId, {
      'usage.botsCreated': 1,
    });

    // Prepare response
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
        createdAt: bot.createdAt,
        limits: bot.limits,
      },
      message: 'Bot created successfully',
    };

    PerformanceMonitor.endTimer('bot-creation-api');
    
    return NextResponse.json(responseData, { status: 201 });

  } catch (error) {
    PerformanceMonitor.endTimer('bot-creation-api', 'error');
    console.error('Bot creation API error:', error);

    // Handle duplicate key errors
    if (error.code === 11000) {
      if (error.keyPattern?.botKey) {
        return NextResponse.json(
          { error: 'Bot key conflict, please try again' },
          { status: 409 }
        );
      }
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return NextResponse.json(
        { error: 'Validation failed', details: validationErrors },
        { status: 400 }
      );
    }

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
 * GET /api/bots - Get user's bots
 */
export async function GET(request) {
  try {
    // Authentication check
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Connect to database
    await connectDB();

    // Parse query parameters
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page')) || 1;
    const limit = parseInt(url.searchParams.get('limit')) || 10;
    const status = url.searchParams.get('status') || 'active';

    // Calculate skip for pagination
    const skip = (page - 1) * limit;

    // Build query
    const query = { ownerId: userId };
    if (status && status !== 'all') {
      query.status = status;
    }

    // Get bots with pagination
    const [bots, totalCount] = await Promise.all([
      Bot.find(query)
        .select('-vectorStorage.collectionName') // Exclude sensitive data
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Bot.countDocuments(query)
    ]);

    // Format response
    const responseData = {
      success: true,
      bots: bots.map(bot => ({
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
      })),
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
        hasNext: page < Math.ceil(totalCount / limit),
        hasPrev: page > 1,
      },
    };

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Get bots API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Generate unique bot key
 */
function generateBotKey() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `bot_${timestamp}_${random}`;
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

  const validated = { ...defaults };

  // Validate bubble color (hex format)
  if (customization.bubbleColor && /^#[0-9A-F]{6}$/i.test(customization.bubbleColor)) {
    validated.bubbleColor = customization.bubbleColor;
  }

  // Validate position
  const validPositions = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
  if (customization.position && validPositions.includes(customization.position)) {
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