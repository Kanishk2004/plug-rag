/**
 * Bots API Routes
 *
 * This module handles all bot-related operations including creation, retrieval,
 * and management for authenticated users. It provides endpoints for:
 * - Creating new bots with customization options
 * - Retrieving user's bots with pagination and filtering
 * - Managing bot limits and usage tracking
 *
 * Routes:
 * - POST /api/bots - Create a new bot
 * - GET /api/bots - Get user's bots with pagination and filtering
 */

import { auth } from '@clerk/nextjs/server';
import connect from '@/lib/integrations/mongo';
import Bot from '@/models/Bot';
import { botService } from '@/lib/core/botService';
import {
	getCurrentDBUser,
	syncUserWithDB,
	updateUserUsage,
	checkUserLimitsFromUser,
} from '@/lib/integrations/clerk';
import {
	apiSuccess,
	authError,
	conflictError,
	serverError,
	validationError,
	paginatedResponse,
	forbiddenError,
	createdResponse,
} from '@/lib/utils/apiResponse';

/**
 * POST /api/bots - Create a new bot
 *
 * Request Body:
 * {
 *   name: string (2-50 chars, required)
 *   description: string (max 500 chars, required)
 *   customization?: {
 *     bubbleColor?: string (hex color)
 *     position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
 *     greeting?: string (max 200 chars)
 *     placeholder?: string (max 100 chars)
 *     title?: string (max 50 chars)
 *   }
 * }
 */
export async function POST(request) {
	try {
		// Step 1: Authenticate user
		const { userId } = await auth();
		if (!userId) return authError();

		// Step 2: Get user from database and sync if needed
		// This ensures the user exists in our MongoDB and has proper limits set
		let user = await getCurrentDBUser(userId);
		if (!user) {
			console.log('User not found in DB, creating user...');
			user = await syncUserWithDB(userId);
			if (!user) return authError('failed to create user in DB');
		}

		// Step 3: Check user plan limits before creating bot
		// Prevents users from exceeding their plan's bot or storage limits
		const { limits } = checkUserLimitsFromUser(user);
		if (limits.botsReached || limits.storageReached)
			return forbiddenError('Plan limits reached', limits);

		// Step 4: Parse and validate request body
		const body = await request.json();
		const { name, description, customization = {} } = body;

		// Validate required fields
		if (!name || !description)
			return validationError('Name and description are required');

		// Validate field lengths
		if (name.length < 2 || name.length > 50)
			return validationError('Name must be between 2 and 50 characters');
		if (description.length > 500)
			return validationError('Description cannot exceed 500 characters');

		// Step 5: Validate and sanitize customization options
		const validatedCustomization = validateCustomization(customization);

		// Step 6: Generate unique bot identifier
		const botKey = generateBotKey();

		// Step 7: Create bot record with all necessary configurations
		const bot = new Bot({
			ownerId: userId,
			name: name.trim(),
			description: description.trim(),
			botKey,
			status: 'active',
			customization: validatedCustomization,
			analytics: {
				lastActiveAt: new Date(),
			},
		});

		// Step 8: Save bot to database
		await bot.save();

		// Step 9: Update user's usage statistics
		await updateUserUsage(userId, {
			'usage.botsCreated': 1,
		});

		// Step 10: Prepare standardized response data
		const responseData = {
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
		};

		return createdResponse(responseData, 'Bot created successfully');
	} catch (error) {
		console.error('Bot creation API error:', error);

		// Handle specific database errors
		if (error.code === 11000) {
			// Duplicate key error (extremely rare due to timestamp-based botKey)
			if (error.keyPattern?.botKey)
				return conflictError('Bot key already exists');
		}

		// Handle Mongoose validation errors
		if (error.name === 'ValidationError') {
			const validationErrors = Object.values(error.errors).map(
				(err) => err.message
			);
			return validationError('Validation failed', validationErrors);
		}

		// Generic server error for unexpected issues
		return serverError('Failed to create bot');
	}
}

/**
 * GET /api/bots - Get user's bots with pagination and filtering
 *
 * Retrieves a paginated list of bots belonging to the authenticated user.
 * Supports filtering by status and searching by name/description.
 *
 * Query Parameters:
 * - page?: number (default: 1) - Page number for pagination
 * - limit?: number (default: 10, max: 50) - Items per page
 * - status?: 'all' | 'active' | 'inactive' | 'training' | 'error' - Filter by bot status
 * - search?: string - Search in bot name or description (case-insensitive)
 *
 * Response Format:
 * {
 *   success: true,
 *   message: "Retrieved X bots successfully",
 *   data: {
 *     items: [
 *       {
 *         id: string,
 *         name: string,
 *         description: string,
 *         botKey: string,
 *         status: string,
 *         fileCount: number,
 *         totalTokens: number,
 *         totalMessages: number,
 *         lastActiveAt: Date,
 *         customization: object,
 *         createdAt: Date,
 *         updatedAt: Date
 *       }
 *     ],
 *     pagination: {
 *       page: number,
 *       limit: number,
 *       total: number,
 *       totalPages: number,
 *       hasNextPage: boolean,
 *       hasPrevPage: boolean
 *     }
 *   }
 * }
 *
 * Response Codes:
 * - 200: Bots retrieved successfully
 * - 401: Authentication required
 * - 500: Internal server error
 */
export async function GET(request) {
	try {
		// Step 1: Authenticate user
		const { userId } = await auth();
		if (!userId) return authError();

		// Step 2: Connect to database
		await connect();

		// Step 3: Ensure user exists in database and sync if needed
		// This handles cases where user exists in Clerk but not in our MongoDB
		let user = await getCurrentDBUser(userId);
		if (!user) {
			console.log('User not found in DB, creating user...');
			user = await syncUserWithDB(userId);
			if (!user) return authError('Failed to create user in DB');
		}

		// Step 4: Parse and validate query parameters
		const { searchParams } = new URL(request.url);
		const page = parseInt(searchParams.get('page')) || 1;
		const limit = Math.min(parseInt(searchParams.get('limit')) || 10, 50); // Prevent excessive data
		const status = searchParams.get('status') || 'all';
		const search = searchParams.get('search') || '';

		// Step 5: Build MongoDB query for filtering
		const query = { ownerId: userId }; // Base query - only user's bots

		// Add status filter if specified and valid
		if (status && status !== 'all') {
			const validStatuses = ['active', 'inactive', 'training', 'error'];
			if (validStatuses.includes(status)) {
				query.status = status;
			}
		}

		// Add search functionality using regex for case-insensitive matching
		if (search.trim()) {
			query.$or = [
				{ name: { $regex: search, $options: 'i' } },
				{ description: { $regex: search, $options: 'i' } },
			];
		}

		// Step 6: Calculate pagination offset
		const skip = (page - 1) * limit;

		// Step 7: Execute database queries in parallel for better performance
		// This runs the bot query and count query simultaneously
		const [bots, totalCount] = await Promise.all([
			Bot.find(query)
				.select({
					// Select only necessary fields to optimize data transfer
					name: 1,
					description: 1,
					botKey: 1,
					status: 1,
					fileCount: 1,
					customization: 1,
					createdAt: 1,
					updatedAt: 1,
					// New analytics object
					'analytics.totalMessages': 1,
					'analytics.totalSessions': 1,
					'analytics.totalTokensUsed': 1,
					'analytics.totalEmbeddings': 1,
					'analytics.storageUsed': 1,
					'analytics.lastActiveAt': 1,
				})
				.sort({ createdAt: -1 }) // Newest first
				.skip(skip)
				.limit(limit)
				.lean(), // Use lean() for better performance (returns plain objects)
			Bot.countDocuments(query), // Get total count for pagination
		]);

		// Step 8: Format bot data for consistent API response
		const formattedBots = bots.map((bot) => ({
			id: bot._id, // Convert _id to id for frontend consistency
			name: bot.name,
			description: bot.description,
			botKey: bot.botKey,
			status: bot.status,
			fileCount: bot.fileCount || 0,

			// Standardized analytics object with legacy fallback
			analytics: {
				totalTokensUsed: bot.analytics?.totalTokensUsed || bot.totalTokens || 0,
				totalMessages: bot.analytics?.totalMessages || bot.totalMessages || 0,
				totalSessions: bot.analytics?.totalSessions || 0,
				totalEmbeddings:
					bot.analytics?.totalEmbeddings || bot.totalEmbeddings || 0,
				storageUsed: bot.analytics?.storageUsed || bot.storageUsed || 0,
				lastActiveAt: bot.analytics?.lastActiveAt || bot.updatedAt,
			},

			customization: bot.customization,
			createdAt: bot.createdAt,
			updatedAt: bot.updatedAt,
		}));

		// Step 9: Return standardized paginated response
		return paginatedResponse(
			formattedBots,
			{ page, limit, total: totalCount },
			`Retrieved ${formattedBots.length} bot${
				formattedBots.length !== 1 ? 's' : ''
			} successfully`
		);
	} catch (error) {
		console.error('Get bots API error:', error);
		return serverError('Failed to retrieve bots');
	}
}

// ===================================================================
// HELPER FUNCTIONS
// ===================================================================

function generateBotKey() {
	const timestamp = Date.now().toString(36); // Convert to base36 for shorter string
	const random = Math.random().toString(36).substring(2, 8); // 6 random chars
	return `bot_${timestamp}_${random}`;
}

function validateCustomization(customization) {
	// Define safe defaults that work well for most use cases
	const defaults = {
		bubbleColor: '#f97316', // Orange color that stands out
		position: 'bottom-right', // Most common position
		greeting: 'Hello! How can I help you today?',
		placeholder: 'Type your message...',
		title: 'Chat Assistant',
	};

	// Start with defaults and override with valid user values
	const validated = { ...defaults };

	// Validate bubble color: Must be 6-digit hex color
	if (
		customization.bubbleColor &&
		/^#[0-9A-F]{6}$/i.test(customization.bubbleColor)
	) {
		validated.bubbleColor = customization.bubbleColor;
	}

	// Validate position: Must be one of the 4 corner positions
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

	// Validate text fields with length limits and trimming
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
