import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongo';
import Bot from '@/models/Bot';
import Conversation from '@/models/Conversation';
import { 
  apiSuccess,
  validationError,
  notFoundError,
  serverError
} from '@/lib/apiResponse';

/**
 * POST /api/chat/[botId] - Handle chat messages (Public, no authentication required)
 */
export async function POST(request, { params }) {
  try {
    const { botId } = await params;
    if (!botId) {
      return validationError('Bot ID is required');
    }

    // Connect to database
    await connectDB();

    // Parse request body
    const body = await request.json();
    const { message, sessionId, userFingerprint, domain } = body;

    if (!message || !sessionId) {
      return validationError('Message and sessionId are required');
    }

    // Verify bot exists and is active
    const bot = await Bot.findOne({ 
      _id: botId, 
      status: 'active' 
    });

    if (!bot) {
      return notFoundError('Bot not found or inactive');
    }

    // Get or create conversation for this session
    let conversation = await Conversation.findOne({ 
      botId: botId, 
      sessionId: sessionId 
    });

    if (!conversation) {
      // Create new conversation for this session
      conversation = new Conversation({
        botId: botId,
        sessionId: sessionId,
        userFingerprint: userFingerprint || '',
        userAgent: request.headers.get('user-agent') || '',
        ipAddress: request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown',
        domain: domain || request.headers.get('origin') || 'unknown',
        referrer: request.headers.get('referer') || '',
        messages: [],
        totalMessages: 0,
        totalTokens: 0,
        status: 'active',
      });
    }

    // Add user message to conversation
    const userMessage = {
      role: 'user',
      content: message,
      timestamp: new Date(),
      tokens: 0, // Will be calculated when implementing AI response
    };

    conversation.messages.push(userMessage);
    conversation.totalMessages += 1;
    conversation.lastMessageAt = new Date();

    // TODO: Implement AI response generation with vector search
    // For now, return a simple response
    const assistantMessage = {
      role: 'assistant',
      content: `Hello! I'm ${bot.name}. I received your message: "${message}". I'm currently being set up to provide intelligent responses based on my knowledge base.`,
      timestamp: new Date(),
      tokens: 0, // Will be calculated when implementing AI response
      responseTime: 500,
      model: 'gpt-3.5-turbo',
    };

    conversation.messages.push(assistantMessage);
    conversation.totalMessages += 1;
    conversation.lastMessageAt = new Date();

    // Calculate total tokens for conversation
    const totalTokensInConversation = conversation.messages.reduce((sum, msg) => sum + (msg.tokens || 0), 0);
    conversation.totalTokens = totalTokensInConversation;

    // Save conversation
    await conversation.save();

    // Update bot message count efficiently
    await Bot.updateOne(
      { _id: botId },
      { 
        $inc: { 
          totalMessages: 2, // user + assistant message
          totalTokens: totalTokensInConversation 
        },
        $set: { updatedAt: new Date() }
      }
    );

    return apiSuccess(
      {
        response: assistantMessage.content,
        sessionId: sessionId,
        messageId: assistantMessage._id,
        conversationId: conversation._id,
      },
      'Message sent successfully'
    );

  } catch (error) {
    console.error('Chat API error:', error);
    return serverError('Failed to process chat message');
  }
}

/**
 * GET /api/chat/[botId] - Get conversation history (Public, no authentication required)
 */
export async function GET(request, { params }) {
  try {
    const { botId } = await params;
    if (!botId) {
      return validationError('Bot ID is required');
    }

    // Connect to database
    await connectDB();

    // Get sessionId from query parameters
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    // If no sessionId provided, return empty conversation
    if (!sessionId) {
      return apiSuccess(
        {
          messages: [],
          sessionId: null,
          conversationId: null,
          totalMessages: 0,
        },
        'No session ID provided - fresh conversation'
      );
    }

    // Verify bot exists and is active
    const bot = await Bot.findOne({ 
      _id: botId, 
      status: 'active' 
    });

    if (!bot) {
      return notFoundError('Bot not found or inactive');
    }

    // Get conversation for this session
    const conversation = await Conversation.findOne({ 
      botId: botId, 
      sessionId: sessionId 
    });

    if (!conversation) {
      return apiSuccess(
        {
          messages: [],
          sessionId: sessionId,
          conversationId: null,
          totalMessages: 0,
        },
        'No conversation found for this session'
      );
    }

    // Format messages for response
    const messages = conversation.messages.map(msg => ({
      id: msg._id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      tokens: msg.tokens,
      responseTime: msg.responseTime,
    }));

    return apiSuccess(
      {
        messages: messages,
        sessionId: sessionId,
        conversationId: conversation._id,
        totalMessages: conversation.totalMessages,
      },
      `Retrieved ${messages.length} messages successfully`
    );

  } catch (error) {
    console.error('Get conversation API error:', error);
    return serverError('Failed to retrieve conversation history');
  }
}

/**
 * DELETE /api/chat/[botId] - Clear conversation history (Public, no authentication required)
 */
export async function DELETE(request, { params }) {
  try {
    const { botId } = await params;
    if (!botId) {
      return validationError('Bot ID is required');
    }

    // Connect to database
    await connectDB();

    // Get sessionId from query parameters
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    // If no sessionId provided, nothing to delete
    if (!sessionId) {
      return apiSuccess(
        {
          deletedCount: 0,
          sessionId: null,
        },
        'No session ID provided - nothing to clear'
      );
    }

    // Delete conversation for this session
    const result = await Conversation.deleteOne({ 
      botId: botId, 
      sessionId: sessionId 
    });

    return apiSuccess(
      {
        deletedCount: result.deletedCount,
        sessionId: sessionId,
      },
      result.deletedCount > 0 
        ? 'Conversation history cleared successfully'
        : 'No conversation found to clear'
    );

  } catch (error) {
    console.error('Clear conversation API error:', error);
    return serverError('Failed to clear conversation history');
  }
}