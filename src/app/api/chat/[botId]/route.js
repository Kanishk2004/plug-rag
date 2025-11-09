import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import ragService from '@/lib/ragService';
import DashboardConversation from '@/models/DashboardConversation';
import Message from '@/models/Message';
import Bot from '@/models/Bot';
import connect from '@/lib/mongo';

// API Logger
const apiLogger = {
  info: (endpoint, data) => console.log(`[CHAT-API-${endpoint.toUpperCase()}] ℹ️`, data),
  success: (endpoint, data) => console.log(`[CHAT-API-${endpoint.toUpperCase()}] ✅`, data),
  error: (endpoint, data) => console.log(`[CHAT-API-${endpoint.toUpperCase()}] ❌`, data),
  debug: (endpoint, data) => console.log(`[CHAT-API-${endpoint.toUpperCase()}] 🐛 DEBUG:`, data),
  timing: (endpoint) => {
    const start = Date.now();
    return {
      end: () => {
        const duration = Date.now() - start;
        console.log(`[CHAT-API-${endpoint.toUpperCase()}] ⏱️ Completed in ${duration}ms`);
        return duration;
      }
    };
  }
};

/**
 * POST /api/chat/[botId]
 * Send a message to the bot and get a response
 */
export async function POST(request, { params }) {
  const timer = apiLogger.timing('post');
  
  try {
    // Get parameters
    const resolvedParams = await params;
    const botId = resolvedParams.botId;
    
    apiLogger.info('post', { 
      botId,
      method: 'POST',
      url: request.url 
    });

    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      apiLogger.error('post', { error: 'Unauthorized - no user ID' });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Connect to MongoDB
    await connect();
    apiLogger.debug('post', { message: 'MongoDB connected' });

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      apiLogger.error('post', { error: 'Invalid JSON in request body' });
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      );
    }

    const { message, settings = {} } = body;

    // Validate message
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      apiLogger.error('post', { error: 'Message is required' });
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    if (message.length > 1000) {
      apiLogger.error('post', { error: 'Message too long', length: message.length });
      return NextResponse.json(
        { error: 'Message too long (max 1000 characters)' },
        { status: 400 }
      );
    }

    // Verify bot exists and user has access
    const bot = await Bot.findById(botId);
    if (!bot) {
      apiLogger.error('post', { error: 'Bot not found', botId });
      return NextResponse.json(
        { error: 'Bot not found' },
        { status: 404 }
      );
    }

    if (bot.ownerId !== userId) {
      apiLogger.error('post', { 
        error: 'Access denied', 
        botId, 
        botOwnerId: bot.ownerId, 
        requestUserId: userId 
      });
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Check if bot is active
    if (bot.status !== 'active') {
      apiLogger.error('post', { 
        error: 'Bot is not active', 
        botId, 
        status: bot.status 
      });
      return NextResponse.json(
        { error: 'Bot is not active' },
        { status: 400 }
      );
    }

    apiLogger.debug('post', {
      botName: bot.name,
      botStatus: bot.status,
      messageLength: message.length,
      settings
    });

    // Process query through RAG pipeline
    const result = await ragService.processQuery(
      botId,
      userId,
      message.trim(),
      settings
    );

    const responseData = {
      success: true,
      conversation: {
        id: result.conversation._id,
        messageCount: result.conversation.analytics.messageCount
      },
      userMessage: {
        id: result.userMessage._id,
        content: result.userMessage.content,
        timestamp: result.userMessage.createdAt
      },
      assistantMessage: {
        id: result.assistantMessage._id,
        content: result.assistantMessage.content,
        timestamp: result.assistantMessage.createdAt,
        sources: result.sources.map(source => ({
          fileName: source.fileName,
          similarityScore: source.similarityScore,
          chunkContent: source.chunkContent
        }))
      },
      metadata: {
        tokensUsed: result.metadata.usage?.total_tokens || 0,
        responseTime: result.metadata.totalDuration,
        sourcesCount: result.sources.length,
        model: result.metadata.model
      }
    };

    apiLogger.success('post', {
      conversationId: result.conversation._id,
      tokensUsed: result.metadata.usage?.total_tokens || 0,
      sourcesCount: result.sources.length,
      responseLength: result.assistantMessage.content.length
    });

    timer.end();
    return NextResponse.json(responseData);

  } catch (error) {
    apiLogger.error('post', {
      error: error.message,
      stack: error.stack,
      botId: resolvedParams?.botId
    });

    timer.end();
    
    // Return appropriate error response
    if (error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Resource not found' },
        { status: 404 }
      );
    }

    if (error.message.includes('Vector storage not enabled')) {
      return NextResponse.json(
        { error: 'Bot is not configured for chat. Please upload documents first.' },
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
 * GET /api/chat/[botId]
 * Get conversation history and suggested questions
 */
export async function GET(request, { params }) {
  const timer = apiLogger.timing('get');
  
  try {
    // Get parameters
    const resolvedParams = await params;
    const botId = resolvedParams.botId;
    
    apiLogger.info('get', { 
      botId,
      method: 'GET',
      url: request.url 
    });

    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      apiLogger.error('get', { error: 'Unauthorized - no user ID' });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Connect to MongoDB
    await connect();
    apiLogger.debug('get', { message: 'MongoDB connected' });

    // Verify bot exists and user has access
    const bot = await Bot.findById(botId);
    if (!bot) {
      apiLogger.error('get', { error: 'Bot not found', botId });
      return NextResponse.json(
        { error: 'Bot not found' },
        { status: 404 }
      );
    }

    if (bot.ownerId !== userId) {
      apiLogger.error('get', { 
        error: 'Access denied', 
        botId, 
        botOwnerId: bot.ownerId, 
        requestUserId: userId 
      });
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get or create active conversation
    const conversation = await DashboardConversation.getOrCreateActiveConversation(botId, userId);
    
    // Get conversation messages
    const messages = await Message.getConversationMessages(conversation._id);
    
    // Generate suggested questions
    const suggestedQuestions = await ragService.generateSuggestedQuestions(botId);

    const responseData = {
      success: true,
      bot: {
        id: bot._id,
        name: bot.name,
        description: bot.description,
        status: bot.status
      },
      conversation: {
        id: conversation._id,
        messageCount: conversation.analytics.messageCount,
        lastMessageAt: conversation.lastMessageAt
      },
      messages: messages.map(msg => ({
        id: msg._id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.createdAt,
        sources: msg.role === 'assistant' ? msg.sources.map(source => ({
          fileName: source.fileName,
          similarityScore: source.similarityScore,
          chunkContent: source.chunkContent
        })) : undefined
      })),
      suggestedQuestions,
      metadata: {
        totalMessages: messages.length,
        hasVectorStorage: bot.vectorStorage?.enabled || false
      }
    };

    apiLogger.success('get', {
      conversationId: conversation._id,
      messagesCount: messages.length,
      suggestedQuestionsCount: suggestedQuestions.length,
      hasVectorStorage: bot.vectorStorage?.enabled || false
    });

    timer.end();
    return NextResponse.json(responseData);

  } catch (error) {
    apiLogger.error('get', {
      error: error.message,
      stack: error.stack,
      botId: resolvedParams?.botId
    });

    timer.end();
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/chat/[botId]
 * Clear conversation history
 */
export async function DELETE(request, { params }) {
  const timer = apiLogger.timing('delete');
  
  try {
    // Get parameters
    const resolvedParams = await params;
    const botId = resolvedParams.botId;
    
    apiLogger.info('delete', { 
      botId,
      method: 'DELETE',
      url: request.url 
    });

    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      apiLogger.error('delete', { error: 'Unauthorized - no user ID' });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Connect to MongoDB
    await connect();
    apiLogger.debug('delete', { message: 'MongoDB connected' });

    // Verify bot exists and user has access
    const bot = await Bot.findById(botId);
    if (!bot) {
      apiLogger.error('delete', { error: 'Bot not found', botId });
      return NextResponse.json(
        { error: 'Bot not found' },
        { status: 404 }
      );
    }

    if (bot.ownerId !== userId) {
      apiLogger.error('delete', { 
        error: 'Access denied', 
        botId, 
        botOwnerId: bot.ownerId, 
        requestUserId: userId 
      });
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Find active conversation
    const conversation = await DashboardConversation.findActiveByBotAndUser(botId, userId);
    
    if (conversation) {
      // Delete all messages in the conversation
      const deletedMessages = await Message.deleteMany({ conversationId: conversation._id });
      
      // Archive the conversation
      await conversation.archive();
      
      apiLogger.success('delete', {
        conversationId: conversation._id,
        messagesDeleted: deletedMessages.deletedCount
      });
    } else {
      apiLogger.debug('delete', { message: 'No active conversation found to delete' });
    }

    timer.end();
    return NextResponse.json({
      success: true,
      message: 'Conversation cleared successfully'
    });

  } catch (error) {
    apiLogger.error('delete', {
      error: error.message,
      stack: error.stack,
      botId: resolvedParams?.botId
    });

    timer.end();
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}