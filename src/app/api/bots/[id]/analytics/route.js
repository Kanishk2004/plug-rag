import { auth } from '@clerk/nextjs/server';
import connect from '@/lib/integrations/mongo';
import Bot from '@/models/Bot';
import Conversation from '@/models/Conversation';
import { getCurrentDBUser, syncUserWithDB } from '@/lib/integrations/clerk';
import {
	apiSuccess,
	authError,
	notFoundError,
	serverError,
	validationError,
} from '@/lib/utils/apiResponse';
import mongoose from 'mongoose';

/**
 * GET /api/bots/[id]/analytics - Get bot analytics and metrics
 *
 * Returns time-series analytics data and summary statistics for a bot.
 * Default: Last 30 days with daily granularity
 *
 * Query parameters:
 * - startDate: ISO date string (optional, defaults to 30 days ago)
 * - endDate: ISO date string (optional, defaults to now)
 * - granularity: 'daily' | 'hourly' (optional, defaults to 'daily')
 *
 * @param {Request} request - The request object
 * @param {Object} params - Route parameters containing bot ID
 * @returns {Response} Analytics data with time-series and summary
 */
export async function GET(request, { params }) {
	try {
		// Step 1: Authenticate user
		const { userId } = await auth();
		if (!userId) return authError();

		// Step 2: Await params and validate bot ID
		const { id: botId } = await params;
		if (!botId) return validationError('Bot ID is required');

		if (!mongoose.Types.ObjectId.isValid(botId)) {
			return validationError('Invalid bot ID format');
		}

		// Step 3: Parse query parameters
		const { searchParams } = new URL(request.url);
		const granularity = searchParams.get('granularity') || 'daily';

		// Default to last 30 days
		const endDate = searchParams.get('endDate')
			? new Date(searchParams.get('endDate'))
			: new Date();
		const startDate = searchParams.get('startDate')
			? new Date(searchParams.get('startDate'))
			: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

		// Validate dates
		if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
			return validationError('Invalid date format. Use ISO 8601 format.');
		}

		if (startDate > endDate) {
			return validationError('startDate must be before endDate');
		}

		// Step 4: Connect to database
		await connect();

		// Step 5: Ensure user exists in database
		let user = await getCurrentDBUser(userId);
		if (!user) {
			user = await syncUserWithDB(userId);
			if (!user) return authError('Failed to create user in DB');
		}

		// Step 6: Verify bot ownership
		const bot = await Bot.findOne({
			_id: botId,
			ownerId: userId,
		}).lean();

		if (!bot) {
			return notFoundError('Bot not found or access denied');
		}

		// Step 7: Fetch conversations within date range
		const conversations = await Conversation.find({
			botId: new mongoose.Types.ObjectId(botId),
			createdAt: { $gte: startDate, $lte: endDate },
		}).lean();

		// Step 8: Calculate analytics
		const analytics = calculateAnalytics(
			conversations,
			startDate,
			endDate,
			granularity
		);

		return apiSuccess({
			period: {
				startDate: startDate.toISOString(),
				endDate: endDate.toISOString(),
				granularity,
			},
			summary: analytics.summary,
			timeSeries: analytics.timeSeries,
			breakdown: analytics.breakdown,
		});
	} catch (error) {
		console.error('Error fetching bot analytics:', error);
		return serverError('Failed to fetch analytics data');
	}
}

/**
 * Calculate analytics from conversations
 *
 * @param {Array} conversations - Array of conversation documents
 * @param {Date} startDate - Start date for analytics
 * @param {Date} endDate - End date for analytics
 * @param {string} granularity - Time bucket size ('daily' or 'hourly')
 * @returns {Object} Calculated analytics data
 */
function calculateAnalytics(conversations, startDate, endDate, granularity) {
	// Initialize time buckets
	const timeBuckets = createTimeBuckets(startDate, endDate, granularity);
	const bucketMap = new Map();

	// Initialize each bucket
	timeBuckets.forEach((date) => {
		bucketMap.set(date, {
			date,
			messages: 0,
			sessions: 0,
			tokens: 0,
			totalResponseTime: 0,
			responseCount: 0,
			responseTypes: {
				faq: 0,
				rag: 0,
				simple_llm: 0,
				small_talk: 0,
			},
		});
	});

	// Trackers for summary and breakdown
	const domainCount = new Map();
	const userAgentCount = new Map();
	const uniqueSessions = new Set();
	let totalMessages = 0;
	let totalTokens = 0;
	let totalResponseTime = 0;
	let responseTimeCount = 0;
	const responseTypeTotals = {
		faq: 0,
		rag: 0,
		simple_llm: 0,
		small_talk: 0,
	};

	// Process each conversation
	conversations.forEach((conversation) => {
		const conversationDate = new Date(conversation.createdAt);
		const bucketKey = getBucketKey(conversationDate, granularity);
		const bucket = bucketMap.get(bucketKey);

		if (bucket) {
			// Count session once per bucket
			bucket.sessions++;
			uniqueSessions.add(conversation.sessionId);

			// Track domain
			if (conversation.domain) {
				domainCount.set(
					conversation.domain,
					(domainCount.get(conversation.domain) || 0) + 1
				);
			}

			// Track user agent
			if (conversation.userAgent) {
				const browser = parseUserAgent(conversation.userAgent);
				userAgentCount.set(browser, (userAgentCount.get(browser) || 0) + 1);
			}

			// Process messages
			conversation.messages.forEach((message) => {
				if (message.role === 'assistant') {
					bucket.messages++;
					totalMessages++;

					// Token usage
					if (message.tokens) {
						bucket.tokens += message.tokens;
						totalTokens += message.tokens;
					}

					// Response time
					if (message.responseTime) {
						bucket.totalResponseTime += message.responseTime;
						bucket.responseCount++;
						totalResponseTime += message.responseTime;
						responseTimeCount++;
					}

					// Response type
					if (message.responseType) {
						bucket.responseTypes[message.responseType]++;
						responseTypeTotals[message.responseType]++;
					}
				}
			});
		}
	});

	// Calculate time series with average response times
	const timeSeries = Array.from(bucketMap.values()).map((bucket) => ({
		date: bucket.date,
		messages: bucket.messages,
		sessions: bucket.sessions,
		tokens: bucket.tokens,
		avgResponseTime:
			bucket.responseCount > 0
				? Math.round(bucket.totalResponseTime / bucket.responseCount)
				: 0,
		responseTypes: bucket.responseTypes,
	}));

	// Calculate summary statistics
	const summary = {
		totalMessages,
		totalSessions: uniqueSessions.size,
		totalTokens,
		avgResponseTime:
			responseTimeCount > 0
				? Math.round(totalResponseTime / responseTimeCount)
				: 0,
		avgMessagesPerSession:
			uniqueSessions.size > 0
				? parseFloat((totalMessages / uniqueSessions.size).toFixed(2))
				: 0,
		avgTokensPerMessage:
			totalMessages > 0 ? Math.round(totalTokens / totalMessages) : 0,
	};

	// Calculate breakdowns
	const breakdown = {
		responseTypes: calculatePercentages(responseTypeTotals, totalMessages),
		topDomains: getTopItems(domainCount, 10),
		topBrowsers: getTopItems(userAgentCount, 10),
	};

	return {
		summary,
		timeSeries,
		breakdown,
	};
}

/**
 * Create time buckets for the given date range
 *
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {string} granularity - 'daily' or 'hourly'
 * @returns {Array<string>} Array of ISO date strings
 */
function createTimeBuckets(startDate, endDate, granularity) {
	const buckets = [];
	const current = new Date(startDate);

	while (current <= endDate) {
		buckets.push(getBucketKey(current, granularity));

		if (granularity === 'hourly') {
			current.setHours(current.getHours() + 1);
		} else {
			current.setDate(current.getDate() + 1);
		}
	}

	return buckets;
}

/**
 * Get bucket key for a date based on granularity
 *
 * @param {Date} date - Date to get bucket for
 * @param {string} granularity - 'daily' or 'hourly'
 * @returns {string} Bucket key (ISO date string)
 */
function getBucketKey(date, granularity) {
	const d = new Date(date);

	if (granularity === 'hourly') {
		d.setMinutes(0, 0, 0);
		return d.toISOString();
	}

	// Daily - set to midnight UTC
	d.setUTCHours(0, 0, 0, 0);
	return d.toISOString().split('T')[0];
}

/**
 * Calculate percentages for response types
 *
 * @param {Object} counts - Count object
 * @param {number} total - Total count
 * @returns {Object} Percentage object
 */
function calculatePercentages(counts, total) {
	const result = {};

	Object.keys(counts).forEach((key) => {
		result[key] = {
			count: counts[key],
			percentage:
				total > 0 ? parseFloat(((counts[key] / total) * 100).toFixed(2)) : 0,
		};
	});

	return result;
}

/**
 * Get top N items from a count map
 *
 * @param {Map} countMap - Map of items to counts
 * @param {number} limit - Number of top items to return
 * @returns {Array} Array of {name, count} objects
 */
function getTopItems(countMap, limit) {
	return Array.from(countMap.entries())
		.sort((a, b) => b[1] - a[1])
		.slice(0, limit)
		.map(([name, count]) => ({ name, count }));
}

/**
 * Parse user agent to extract browser name
 *
 * @param {string} userAgent - User agent string
 * @returns {string} Browser name
 */
function parseUserAgent(userAgent) {
	if (!userAgent) return 'Unknown';

	const ua = userAgent.toLowerCase();

	if (ua.includes('edg')) return 'Edge';
	if (ua.includes('chrome')) return 'Chrome';
	if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari';
	if (ua.includes('firefox')) return 'Firefox';
	if (ua.includes('opera') || ua.includes('opr')) return 'Opera';
	if (ua.includes('msie') || ua.includes('trident')) return 'Internet Explorer';

	return 'Other';
}
