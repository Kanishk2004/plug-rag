import connect from '@/lib/integrations/mongo';
import Bot from '@/models/Bot';
import Conversation from '@/models/Conversation';
import {
	apiSuccess,
	notFoundError,
	validationError,
	serverError,
} from '@/lib/utils/apiResponse';
import { validateSessionId } from '@/lib/utils/sanitization';

// Helper function to add CORS headers
function addCorsHeaders(response) {
	response.headers.set('Access-Control-Allow-Origin', '*');
	response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
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

/**
 * GET /api/chat/[botId]/history/[sessionId]
 * 
 * Public endpoint to retrieve conversation history for a specific session
 * This is used by the embed widget to restore previous conversations
 * No authentication required - sessions are public by design
 */
export async function GET(request, { params }) {
	try {
		const { botId, sessionId } = await params;

		// Validate botId
		if (!botId) {
			return addCorsHeaders(validationError('Bot ID is required'));
		}

		// Validate and sanitize session ID
		const sessionValidation = validateSessionId(sessionId);
		if (!sessionValidation.valid) {
			return addCorsHeaders(validationError(sessionValidation.error));
		}
		const sanitizedSessionId = sessionValidation.sanitized;

		// Connect to database
		await connect();

		// Verify bot exists
		const bot = await Bot.findById(botId);
		if (!bot) {
			return addCorsHeaders(notFoundError('Bot not found'));
		}

		// Find conversation by sessionId and botId
		const conversation = await Conversation.findOne({
			sessionId: sanitizedSessionId,
			botId: botId,
		}).select('messages sessionId createdAt updatedAt');

		// If no conversation found, return empty array (new session)
		if (!conversation) {
			return addCorsHeaders(
				apiSuccess({
					messages: [],
					sessionId: sanitizedSessionId,
					isNewSession: true,
				})
			);
		}

		// Return conversation messages
		return addCorsHeaders(
			apiSuccess({
				messages: conversation.messages || [],
				sessionId: conversation.sessionId,
				createdAt: conversation.createdAt,
				updatedAt: conversation.updatedAt,
				isNewSession: false,
			})
		);
	} catch (error) {
		console.error('Error fetching conversation history:', error);
		return addCorsHeaders(
			serverError('Failed to fetch conversation history')
		);
	}
}
