import connect from '@/lib/integrations/mongo';
import Conversation from '@/models/Conversation';
import Bot from '@/models/Bot';
import { auth } from '@clerk/nextjs/server';
import {
	apiSuccess,
	apiError,
	authError,
	notFoundError,
	forbiddenError,
} from '@/lib/utils/apiResponse';
import { logInfo, logError } from '@/lib/utils/logger';
import mongoose from 'mongoose';

/**
 * GET /api/bots/[id]/conversations/[sessionId]
 *
 * Retrieves detailed conversation with full message history for a specific session
 *
 * Query Parameters:
 * - includeMetadata: Include detailed metadata for each message (default: true)
 * - limit: Limit number of messages returned (default: all messages)
 * - page: For paginated message history (default: 1)
 */
export async function GET(request, { params }) {
	try {
		await connect();
		const { userId } = await auth();

		// Authentication check
		if (!userId) {
			return authError('Authentication required');
		}

		const resolvedParams = await params;
		const { id: botId, sessionId } = resolvedParams;
		const { searchParams } = new URL(request.url);

		// Extract query parameters
		const includeMetadata = searchParams.get('includeMetadata') !== 'false';
		const messageLimit = searchParams.get('limit')
			? parseInt(searchParams.get('limit'))
			: null;
		const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
		const messagesPerPage = 50; // Fixed page size for message pagination

		// Verify bot ownership
		const bot = await Bot.findById(botId);
		if (!bot) {
			return notFoundError('Bot not found');
		}

		if (bot.ownerId.toString() !== userId) {
			return forbiddenError('Access denied');
		}

		logInfo('Fetching conversation detail', {
			botId,
			sessionId,
			userId,
			includeMetadata,
			messageLimit,
		});

		// Find the conversation
		const conversation = await Conversation.findOne({
			botId: new mongoose.Types.ObjectId(botId),
			sessionId,
		});

		if (!conversation) {
			return notFoundError('Conversation not found');
		}

		// Process messages with optional pagination and limiting
		let messages = conversation.messages || [];
		const totalMessages = messages.length;

		// Apply message limit if specified
		if (messageLimit && messageLimit > 0) {
			messages = messages.slice(-messageLimit); // Get latest messages
		}

		// Apply pagination to messages if requested
		let messagePagination = null;
		if (searchParams.get('page')) {
			const startIndex = (page - 1) * messagesPerPage;
			const endIndex = startIndex + messagesPerPage;
			const paginatedMessages = messages.slice(startIndex, endIndex);

			messagePagination = {
				currentPage: page,
				totalPages: Math.ceil(messages.length / messagesPerPage),
				totalMessages: messages.length,
				messagesPerPage,
				hasNextPage: endIndex < messages.length,
				hasPrevPage: page > 1,
			};

			messages = paginatedMessages;
		}

		// Enhanced message processing with metadata
		const processedMessages = messages.map((msg, index) => {
			const baseMessage = {
				id: msg._id || `msg_${index}`,
				role: msg.role,
				content: msg.content,
				timestamp: msg.timestamp,
			};

			if (includeMetadata) {
				// Add detailed metadata for assistant messages
				if (msg.role === 'assistant') {
					baseMessage.metadata = {
						sources: msg.sources || msg.retrievedChunks || [],
						hasRelevantContext: msg.hasRelevantContext,
						tokens: msg.tokens || 0,
						responseTime: msg.responseTime || 0,
						model: msg.model || 'unknown',
					};

					// Process sources for better display
					if (baseMessage.metadata.sources.length > 0) {
						baseMessage.metadata.sources = baseMessage.metadata.sources.map(
							(source) => ({
								fileName: source.fileName || source.content || 'Unknown file',
								pageNumber: source.pageNumber,
								chunkIndex: source.chunkIndex,
								score: source.score,
							})
						);
					}
				}

				// Add token count for user messages if available
				if (msg.tokens) {
					baseMessage.tokens = msg.tokens;
				}
			}

			return baseMessage;
		});

		// Calculate conversation analytics
		const analytics = {
			totalMessages,
			userMessages: messages.filter((msg) => msg.role === 'user').length,
			assistantMessages: messages.filter((msg) => msg.role === 'assistant')
				.length,
			totalTokensUsed: messages.reduce(
				(sum, msg) => sum + (msg.tokens || 0),
				0
			),
			averageResponseTime: (() => {
				const assistantMessages = messages.filter(
					(msg) => msg.role === 'assistant' && msg.responseTime
				);
				if (assistantMessages.length === 0) return 0;
				const totalResponseTime = assistantMessages.reduce(
					(sum, msg) => sum + (msg.responseTime || 0),
					0
				);
				return Math.round(totalResponseTime / assistantMessages.length);
			})(),
			messagesWithContext: messages.filter(
				(msg) => msg.hasRelevantContext === true
			).length,
			conversationDuration:
				totalMessages > 1
					? new Date(messages[messages.length - 1].timestamp) -
					  new Date(messages[0].timestamp)
					: 0,
			uniqueSources: (() => {
				const sources = new Set();
				messages.forEach((msg) => {
					if (msg.sources) {
						msg.sources.forEach((source) => {
							if (source.fileName) sources.add(source.fileName);
						});
					}
				});
				return sources.size;
			})(),
		};

		// Extract user context and session information
		const sessionInfo = {
			sessionId: conversation.sessionId,
			status: conversation.status,
			userFingerprint: conversation.userFingerprint,
			userAgent: conversation.userAgent,
			ipAddress: conversation.ipAddress,
			domain: conversation.domain,
			referrer: conversation.referrer,
			startedAt: conversation.createdAt,
			lastActivityAt: conversation.updatedAt,
			duration: conversation.updatedAt - conversation.createdAt,
		};

		// Get browser and device info from user agent
		const userAgentInfo = parseUserAgent(conversation.userAgent || '');

		logInfo('Conversation detail fetched successfully', {
			botId,
			sessionId,
			userId,
			totalMessages,
			processedMessages: processedMessages.length,
		});

		return apiSuccess({
			conversation: {
				...sessionInfo,
				messages: processedMessages,
			},
			analytics,
			userAgentInfo,
			messagePagination,
			botInfo: {
				id: bot._id,
				name: bot.name,
				status: bot.status,
			},
		});
	} catch (error) {
		logError('Error fetching conversation detail', error, {
			botId: params?.id,
			sessionId: params?.sessionId,
			userId,
		});

		return apiError(
			'Failed to fetch conversation detail',
			500,
			'SERVER_ERROR',
			process.env.NODE_ENV === 'development' ? error.message : undefined
		);
	}
}

/**
 * DELETE /api/bots/[id]/conversations/[sessionId]
 *
 * Deletes a specific conversation
 */
export async function DELETE(request, { params }) {
	try {
		await connect();
		const { userId } = await auth();

		// Authentication check
		if (!userId) {
			return authError('Authentication required');
		}

		const resolvedParams = await params;
		const { id: botId, sessionId } = resolvedParams;

		// Verify bot ownership
		const bot = await Bot.findById(botId);
		if (!bot) {
			return notFoundError('Bot not found');
		}

		if (bot.ownerId.toString() !== userId) {
			return forbiddenError('Access denied');
		}

		logInfo('Deleting conversation', {
			botId,
			sessionId,
			userId,
		});

		// Delete the conversation
		const result = await Conversation.deleteOne({
			botId: new mongoose.Types.ObjectId(botId),
			sessionId,
		});

		if (result.deletedCount === 0) {
			return notFoundError('Conversation not found');
		}

		logInfo('Conversation deleted successfully', {
			botId,
			sessionId,
			userId,
		});

		return apiSuccess({
			message: 'Conversation deleted successfully',
			deletedSessionId: sessionId,
		});
	} catch (error) {
		logError('Error deleting conversation', error, {
			botId: params?.id,
			sessionId: params?.sessionId,
			userId,
		});

		return apiError(
			'Failed to delete conversation',
			500,
			'SERVER_ERROR',
			process.env.NODE_ENV === 'development' ? error.message : undefined
		);
	}
}

/**
 * Simple user agent parser for basic browser/device information
 */
function parseUserAgent(userAgent) {
	const ua = userAgent.toLowerCase();

	// Extract browser
	let browser = 'Unknown';
	if (ua.includes('chrome')) browser = 'Chrome';
	else if (ua.includes('firefox')) browser = 'Firefox';
	else if (ua.includes('safari')) browser = 'Safari';
	else if (ua.includes('edge')) browser = 'Edge';
	else if (ua.includes('opera')) browser = 'Opera';

	// Extract OS
	let os = 'Unknown';
	if (ua.includes('windows')) os = 'Windows';
	else if (ua.includes('macintosh')) os = 'macOS';
	else if (ua.includes('linux')) os = 'Linux';
	else if (ua.includes('android')) os = 'Android';
	else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

	// Extract device type
	let device = 'Desktop';
	if (ua.includes('mobile') || ua.includes('android')) device = 'Mobile';
	else if (ua.includes('tablet') || ua.includes('ipad')) device = 'Tablet';

	return {
		browser,
		os,
		device,
		raw: userAgent,
	};
}
