import connect from '@/lib/integrations/mongo';
import Conversation from '@/models/Conversation';
import Bot from '@/models/Bot';
import { getAuth } from '@clerk/nextjs/server';
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
 * GET /api/bots/[id]/conversations
 *
 * Retrieves conversations for a specific bot with pagination and filtering options
 *
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Number of conversations per page (default: 20, max: 100)
 * - status: Filter by conversation status ('active', 'ended', or 'all')
 * - dateFrom: Filter conversations from this date (ISO string)
 * - dateTo: Filter conversations until this date (ISO string)
 * - search: Search in conversation messages (partial text match)
 * - domain: Filter by domain
 */
export async function GET(request, { params }) {
	try {
		await connect();
		const { userId } = getAuth(request);

		// Authentication check
		if (!userId) {
			return authError('Authentication required');
		}

		const resolvedParams = await params;
		const { id: botId } = resolvedParams;
		const { searchParams } = new URL(request.url);

		// Extract query parameters
		const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
		const limit = Math.min(
			100,
			Math.max(1, parseInt(searchParams.get('limit') || '20'))
		);
		const status = searchParams.get('status') || 'all';
		const dateFrom = searchParams.get('dateFrom');
		const dateTo = searchParams.get('dateTo');
		const search = searchParams.get('search')?.trim();
		const domain = searchParams.get('domain')?.trim();

		// Verify bot ownership
		const bot = await Bot.findById(botId);
		if (!bot) {
			return notFoundError('Bot not found');
		}

		if (bot.ownerId.toString() !== userId) {
			return forbiddenError('Access denied');
		}

		logInfo('Fetching conversations for bot', {
			botId,
			userId,
			page,
			limit,
			status,
			search: search ? 'present' : 'none',
			domain,
		});

		// Build query filters
		const query = { botId: new mongoose.Types.ObjectId(botId) };

		// Status filter
		if (status && status !== 'all') {
			query.status = status;
		}

		// Date range filter
		if (dateFrom || dateTo) {
			query.createdAt = {};
			if (dateFrom) {
				query.createdAt.$gte = new Date(dateFrom);
			}
			if (dateTo) {
				query.createdAt.$lte = new Date(dateTo);
			}
		}

		// Domain filter
		if (domain) {
			query.domain = { $regex: domain, $options: 'i' };
		}

		// Text search in messages (if provided)
		let conversations = [];
		let totalCount = 0;

		if (search) {
			// Aggregate search across message content
			const searchPipeline = [
				{ $match: query },
				{
					$match: {
						'messages.content': { $regex: search, $options: 'i' },
					},
				},
				{
					$addFields: {
						totalMessages: { $size: '$messages' },
						lastMessageAt: { $max: '$messages.timestamp' },
						// Calculate total tokens used in conversation
						totalTokens: {
							$sum: {
								$map: {
									input: '$messages',
									as: 'msg',
									in: { $ifNull: ['$$msg.tokens', 0] },
								},
							},
						},
					},
				},
				{
					$project: {
						sessionId: 1,
						userFingerprint: 1,
						userAgent: 1,
						ipAddress: 1,
						domain: 1,
						referrer: 1,
						status: 1,
						totalMessages: 1,
						totalTokens: 1,
						lastMessageAt: 1,
						createdAt: 1,
						updatedAt: 1,
						// Only include first and last messages for preview
						firstMessage: { $arrayElemAt: ['$messages', 0] },
						lastMessage: { $arrayElemAt: ['$messages', -1] },
					},
				},
				{ $sort: { lastMessageAt: -1, createdAt: -1 } },
				{ $skip: (page - 1) * limit },
				{ $limit: limit },
			];

			conversations = await Conversation.aggregate(searchPipeline);

			// Get total count for pagination (without skip/limit)
			const countPipeline = [
				{ $match: query },
				{
					$match: {
						'messages.content': { $regex: search, $options: 'i' },
					},
				},
				{ $count: 'total' },
			];

			const countResult = await Conversation.aggregate(countPipeline);
			totalCount = countResult[0]?.total || 0;
		} else {
			// Standard query without text search
			const aggregatePipeline = [
				{ $match: query },
				{
					$addFields: {
						totalMessages: { $size: '$messages' },
						lastMessageAt: { $max: '$messages.timestamp' },
						totalTokens: {
							$sum: {
								$map: {
									input: '$messages',
									as: 'msg',
									in: { $ifNull: ['$$msg.tokens', 0] },
								},
							},
						},
					},
				},
				{
					$project: {
						sessionId: 1,
						userFingerprint: 1,
						userAgent: 1,
						ipAddress: 1,
						domain: 1,
						referrer: 1,
						status: 1,
						totalMessages: 1,
						totalTokens: 1,
						lastMessageAt: 1,
						createdAt: 1,
						updatedAt: 1,
						firstMessage: { $arrayElemAt: ['$messages', 0] },
						lastMessage: { $arrayElemAt: ['$messages', -1] },
					},
				},
				{ $sort: { lastMessageAt: -1, createdAt: -1 } },
				{ $skip: (page - 1) * limit },
				{ $limit: limit },
			];

			conversations = await Conversation.aggregate(aggregatePipeline);
			totalCount = await Conversation.countDocuments(query);
		}

		// Calculate pagination info
		const totalPages = Math.ceil(totalCount / limit);
		const hasNextPage = page < totalPages;
		const hasPrevPage = page > 1;

		// Get summary statistics for the bot
		const statsQuery = [
			{ $match: { botId: new mongoose.Types.ObjectId(botId) } },
			{
				$group: {
					_id: null,
					totalConversations: { $sum: 1 },
					activeConversations: {
						$sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
					},
					totalMessages: {
						$sum: { $size: '$messages' },
					},
					totalTokens: {
						$sum: {
							$sum: {
								$map: {
									input: '$messages',
									as: 'msg',
									in: { $ifNull: ['$$msg.tokens', 0] },
								},
							},
						},
					},
					avgMessagesPerConversation: {
						$avg: { $size: '$messages' },
					},
					lastActivity: { $max: '$updatedAt' },
				},
			},
		];

		const statsResult = await Conversation.aggregate(statsQuery);
		const stats = statsResult[0] || {
			totalConversations: 0,
			activeConversations: 0,
			totalMessages: 0,
			totalTokens: 0,
			avgMessagesPerConversation: 0,
			lastActivity: null,
		};

		logInfo('Conversations fetched successfully', {
			botId,
			userId,
			conversationsCount: conversations.length,
			totalCount,
			page,
			limit,
		});

		return apiSuccess({
			conversations,
			pagination: {
				currentPage: page,
				totalPages,
				totalCount,
				limit,
				hasNextPage,
				hasPrevPage,
			},
			filters: {
				status,
				dateFrom,
				dateTo,
				search,
				domain,
			},
			statistics: {
				...stats,
				avgMessagesPerConversation: Math.round(
					stats.avgMessagesPerConversation || 0
				),
			},
			botInfo: {
				id: bot._id,
				name: bot.name,
				status: bot.status,
			},
		});
	} catch (error) {
		logError('Error fetching conversations', error, {
			botId: params?.id,
			userId: getAuth(request)?.userId,
		});

		return apiError('Failed to fetch conversations', 500, 'SERVER_ERROR');
	}
}
