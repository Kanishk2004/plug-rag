import { auth } from '@clerk/nextjs/server';
import { getCurrentDBUser } from '@/lib/integrations/clerk';
import Bot from '@/models/Bot';
import File from '@/models/File';
import connect from '@/lib/integrations/mongo';
import {
	apiSuccess,
	authError,
	notFoundError,
	serverError,
	validationError,
} from '@/lib/utils/apiResponse';

/**
 * GET /api/files - Get files for a bot
 *
 * Retrieves all files associated with a specific bot.
 * Requires botId as query parameter.
 *
 * @param {Request} request - The request object
 * @returns {Response} List of files for the bot
 */
export async function GET(request) {
	try {
		// Step 1: Authenticate user
		const { userId } = await auth();
		if (!userId) return authError();

		// Step 2: Parse query parameters
		const { searchParams } = new URL(request.url);
		const botId = searchParams.get('botId');

		if (!botId) {
			return validationError('botId parameter is required');
		}

		// Step 3: Connect to database
		await connect();

		// Step 4: Get user and verify existence
		const user = await getCurrentDBUser(userId);
		if (!user) {
			return authError('User not found');
		}

		// Step 5: Verify bot ownership
		const bot = await Bot.findOne({
			_id: botId,
			ownerId: userId, // Use Clerk userId directly, not user._id
		});

		if (!bot) {
			return notFoundError('Bot not found or access denied');
		}

		// Step 6: Get files for the bot
		const files = await File.find({ botId: bot._id })
			.sort({ createdAt: -1 })
			.lean();

		// Step 7: Format file data
		const formattedFiles = files.map((file) => ({
			id: file._id.toString(),
			originalName: file.originalName,
			filename: file.filename,
			mimeType: file.mimeType,
			size: file.size,
			status: file.status,
			embeddingStatus: file.embeddingStatus,
			totalChunks: file.totalChunks || 0,
			vectorCount: file.vectorCount || 0,
			embeddingTokens: file.embeddingTokens || 0,
			estimatedCost: file.estimatedCost || 0,
			processingError: file.processingError,
			embeddedAt: file.embeddedAt,
			processedAt: file.processedAt,
			createdAt: file.createdAt,
			updatedAt: file.updatedAt,
		}));

		return apiSuccess(
			formattedFiles,
			`Retrieved ${formattedFiles.length} files successfully`
		);
	} catch (error) {
		console.error('Get files API error:', error);
		return serverError('Failed to retrieve files');
	}
}
