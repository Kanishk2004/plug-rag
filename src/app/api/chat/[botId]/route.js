import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongo';
import Bot from '@/models/Bot';
import Conversation from '@/models/Conversation';
import { ragService } from '@/lib/ragService';
import { 
  apiSuccess,
  validationError,
  notFoundError,
  serverError
} from '@/lib/apiResponse';

// Helper function to add CORS headers
function addCorsHeaders(response) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return response;
}

// Handle OPTIONS requests for CORS
export async function OPTIONS(request) {
  return addCorsHeaders(new Response(null, { status: 200 }));
}

// Helper function to validate domain whitelist
function validateDomain(bot, requestDomain) {
  if (!bot.domainWhitelist || bot.domainWhitelist.length === 0) {
    return true; // No whitelist means all domains allowed
  }
  
  if (!requestDomain) {
    return false; // No domain provided but whitelist exists
  }
  
  // Remove protocol and normalize domain
  const cleanDomain = requestDomain.replace(/^https?:\/\//, '').split('/')[0];
  
  return bot.domainWhitelist.some(allowedDomain => {
    // Exact match or subdomain match
    return cleanDomain === allowedDomain || cleanDomain.endsWith('.' + allowedDomain);
  });
}

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
      tokens: 0, // Will be calculated if needed
    };

    conversation.messages.push(userMessage);
    conversation.totalMessages += 1;
    conversation.lastMessageAt = new Date();

    // Generate AI response using RAG service
    const botInfo = {
      name: bot.name,
      description: bot.description
    };

    // Get conversation history for context (excluding current message)
    const conversationHistory = conversation.messages.slice(0, -1);

    // Generate intelligent response using vector search
    const aiResponse = await ragService.generateResponse(
      botId,
      message,
      conversationHistory,
      botInfo
    );

    console.log('RAG service response:', aiResponse);
    console.log('AI response content:', aiResponse.content);
    console.log('AI response type:', typeof aiResponse.content);

		// Create assistant message with AI response
		const assistantMessage = {
			role: 'assistant',
			content: aiResponse.content,
			timestamp: new Date(),
			tokens: aiResponse.tokensUsed,
			responseTime: aiResponse.responseTime,
			model: aiResponse.model,
			sources: aiResponse.sources || [],
			hasRelevantContext: aiResponse.hasRelevantContext
		};    conversation.messages.push(assistantMessage);
    conversation.totalMessages += 1;
    conversation.lastMessageAt = new Date();

    // Calculate total tokens for conversation
    const totalTokensInConversation = conversation.messages.reduce((sum, msg) => sum + (msg.tokens || 0), 0);
    conversation.totalTokens = totalTokensInConversation;

    // Save conversation
    await conversation.save();

    // Determine if this is a new session (first time this sessionId is used)
    const isNewSession = conversation.messages.length === 2; // Only user + assistant message means new session

    // Prepare bot analytics updates
    const botUpdates = {
      $inc: {
        'analytics.totalMessages': 2, // user + assistant message
        'analytics.totalTokensUsed': assistantMessage.tokens || 0,
        ...(isNewSession && { 'analytics.totalSessions': 1 })
      },
      $set: { 
        'analytics.lastActiveAt': new Date(),
        updatedAt: new Date()
      }
    };

    // Update bot analytics efficiently
    await Bot.updateOne({ _id: botId }, botUpdates);

		const response = apiSuccess(
			{
				message: assistantMessage.content,
				sessionId: sessionId,
				messageId: assistantMessage._id,
				conversationId: conversation._id,
				sources: assistantMessage.sources,
				responseTime: assistantMessage.responseTime,
				tokensUsed: assistantMessage.tokens,
				hasRelevantContext: assistantMessage.hasRelevantContext
			},
			'Message sent successfully'
		);

		return addCorsHeaders(response);  } catch (error) {
    console.error('Chat API error:', error);
    return addCorsHeaders(serverError('Failed to process chat message'));
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
      return addCorsHeaders(apiSuccess(
        {
          messages: [],
          sessionId: null,
          conversationId: null,
          totalMessages: 0,
        },
        'No session ID provided - fresh conversation'
      ));
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
      return addCorsHeaders(apiSuccess(
        {
          messages: [],
          sessionId: sessionId,
          conversationId: null,
          totalMessages: 0,
        },
        'No conversation found for this session'
      ));
    }

    // Format messages for response
    const messages = conversation.messages.map(msg => ({
      id: msg._id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      tokens: msg.tokens,
      responseTime: msg.responseTime,
      sources: msg.sources || [],
      hasRelevantContext: msg.hasRelevantContext
    }));

    return addCorsHeaders(apiSuccess(
      {
        messages: messages,
        sessionId: sessionId,
        conversationId: conversation._id,
        totalMessages: conversation.totalMessages,
      },
      `Retrieved ${messages.length} messages successfully`
    ));

  } catch (error) {
    console.error('Get conversation API error:', error);
    return addCorsHeaders(serverError('Failed to retrieve conversation history'));
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
      return addCorsHeaders(apiSuccess(
        {
          deletedCount: 0,
          sessionId: null,
        },
        'No session ID provided - nothing to clear'
      ));
    }

    // Delete conversation for this session
    const result = await Conversation.deleteOne({ 
      botId: botId, 
      sessionId: sessionId 
    });

    return addCorsHeaders(apiSuccess(
      {
        deletedCount: result.deletedCount,
        sessionId: sessionId,
      },
      result.deletedCount > 0 
        ? 'Conversation history cleared successfully'
        : 'No conversation found to clear'
    ));

  } catch (error) {
    console.error('Clear conversation API error:', error);
    return addCorsHeaders(serverError('Failed to clear conversation history'));
  }
}