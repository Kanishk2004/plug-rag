import { NextResponse } from 'next/server';
import connect from '@/lib/integrations/mongo';
import Bot from '@/models/Bot';
import Conversation from '@/models/Conversation';
import { chatService } from '@/lib/core/chatService';
import {
	apiSuccess,
	validationError,
	notFoundError,
	serverError,
} from '@/lib/utils/apiResponse';

// Helper function to add CORS headers
function addCorsHeaders(response) {
	response.headers.set('Access-Control-Allow-Origin', '*');
	response.headers.set(
		'Access-Control-Allow-Methods',
		'GET, POST, DELETE, OPTIONS'
	);
	response.headers.set(
		'Access-Control-Allow-Headers',
		'Content-Type, Authorization'
	);
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

	return bot.domainWhitelist.some((allowedDomain) => {
		// Exact match or subdomain match
		return (
			cleanDomain === allowedDomain || cleanDomain.endsWith('.' + allowedDomain)
		);
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
		await connect();

		// Parse request body
		const body = await request.json();
		const { message, sessionId, userFingerprint, domain } = body;

		if (!message || !sessionId) {
			return validationError('Message and sessionId are required');
		}

		// Verify bot exists and is active
		const bot = await Bot.findOne({
			_id: botId,
			status: 'active',
		});

		if (!bot) {
			return notFoundError('Bot not found or inactive');
		}

		// Validate domain against bot's whitelist
		if (!validateDomain(bot, domain)) {
			return validationError('Domain is not allowed to access this bot');
		}

		// Use chat service to handle message processing
		const aiResponse = await chatService.sendMessage(bot, message, sessionId);

		const response = apiSuccess(
			{
				message: aiResponse.content,
				sessionId: sessionId,
				sources: aiResponse.sources,
				hasRelevantContext: aiResponse.hasRelevantContext,
				model: aiResponse.model,
			},
			'Message sent successfully'
		);

		return addCorsHeaders(response);
	} catch (error) {
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
		await connect();

		// Get sessionId from query parameters
		const { searchParams } = new URL(request.url);
		const sessionId = searchParams.get('sessionId');

		// If no sessionId provided, return empty conversation
		if (!sessionId) {
			return addCorsHeaders(
				apiSuccess(
					{
						messages: [],
						sessionId: null,
						totalMessages: 0,
					},
					'No session ID provided - fresh conversation'
				)
			);
		}

		// Use chat service to get conversation history
		const conversationHistory = await chatService.getConversationHistory(
			botId,
			sessionId
		);

		// Format messages for response
		const messages = conversationHistory.messages.map((msg) => ({
			id: msg._id || msg.timestamp?.toISOString(),
			role: msg.role,
			content: msg.content,
			timestamp: msg.timestamp,
			tokens: msg.metadata?.tokensUsed || msg.tokens,
			responseTime: msg.metadata?.responseTime || msg.responseTime,
			sources: msg.metadata?.sources || msg.sources || [],
			hasRelevantContext:
				msg.metadata?.hasRelevantContext || msg.hasRelevantContext,
		}));

		return addCorsHeaders(
			apiSuccess(
				{
					messages: messages,
					sessionId: sessionId,
					totalMessages: conversationHistory.totalMessages,
				},
				`Retrieved ${messages.length} messages successfully`
			)
		);
	} catch (error) {
		console.error('Get conversation API error:', error);
		return addCorsHeaders(
			serverError('Failed to retrieve conversation history')
		);
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
		await connect();

		// Get sessionId from query parameters
		const { searchParams } = new URL(request.url);
		const sessionId = searchParams.get('sessionId');

		// If no sessionId provided, nothing to delete
		if (!sessionId) {
			return addCorsHeaders(
				apiSuccess(
					{
						deleted: false,
						sessionId: null,
					},
					'No session ID provided - nothing to clear'
				)
			);
		}

		// Use chat service to clear conversation history
		const success = await chatService.clearConversationHistory(
			botId,
			sessionId
		);

		return addCorsHeaders(
			apiSuccess(
				{
					deleted: success,
					sessionId: sessionId,
				},
				success
					? 'Conversation history cleared successfully'
					: 'No conversation found to clear'
			)
		);
	} catch (error) {
		console.error('Clear conversation API error:', error);
		return addCorsHeaders(serverError('Failed to clear conversation history'));
	}
}
