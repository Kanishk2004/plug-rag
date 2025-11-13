import { auth } from '@clerk/nextjs/server';
import { getCurrentDBUser, checkUserLimitsFromUser } from '@/lib/user';
import mongoose from 'mongoose';
import Bot from '@/models/Bot';
import File from '@/models/File';
import { processFile } from '@/lib/fileProcessor';
import connectDB from '@/lib/mongo';
import {
	apiSuccess,
	authError,
	notFoundError,
	forbiddenError,
	serverError,
	validationError,
} from '@/lib/apiResponse';

// Configuration
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIME_TYPES = [
	'application/pdf',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'application/msword',
	'text/plain',
	'text/csv',
	'text/html',
];

/**
 * POST /api/files - Upload file
 */
export async function POST(request) {
	try {
		// Authentication check
		const { userId } = await auth();
		if (!userId) return authError();

		// Get current user and check limits
		const user = await getCurrentDBUser(userId);
		if (!user) {
			return notFoundError('User not found');
		}

		// Check user limits using existing user object (optimized)
		const { limits } = checkUserLimitsFromUser(user);
		if (limits.botsReached || limits.storageReached)
			return forbiddenError('Plan limits reached', limits);

		// Parse form data
		const formData = await request.formData();
		const file = formData.get('file');
		const botIdString = formData.get('botId');

		// Parse optional upload options
		const generateEmbeddings = formData.get('generateEmbeddings') === 'true';
		const maxChunkSize = parseInt(formData.get('maxChunkSize')) || 700;
		const overlap = parseInt(formData.get('overlap')) || 100;

		// Validate required fields
		if (!file || !botIdString) {
			console.log('[FILE-UPLOAD] Missing required fields:', {
				hasFile: !!file,
				fileType: typeof file,
				fileConstructor: file?.constructor?.name,
				hasBotId: !!botIdString,
			});
			return validationError('file and botId are required');
		}

		// Validate file is actually a File object
		// Note: instanceof File may fail in server context, so check properties instead
		if (
			!file ||
			typeof file !== 'object' ||
			!file.name ||
			!file.size ||
			typeof file.stream !== 'function'
		) {
			console.log('[FILE-UPLOAD] Invalid file object:', {
				fileType: typeof file,
				fileConstructor: file?.constructor?.name,
				hasName: !!file?.name,
				hasSize: !!file?.size,
				hasStream: typeof file?.stream === 'function',
				isFile: file instanceof File,
			});
			return validationError(
				'Invalid file object - missing required file properties'
			);
		}

		console.log('[FILE-UPLOAD] Processing request', {
			fileName: file?.name,
			botId: botIdString,
			userId,
			fileSize: file?.size,
			generateEmbeddings,
			maxChunkSize,
			overlap,
		});

		let botId;
		try {
			botId = new mongoose.Types.ObjectId(botIdString);
		} catch (error) {
			return validationError('Invalid botId format');
		}

		// Validate bot ownership
		const bot = await Bot.findOne({ _id: botId, ownerId: userId });
		if (!bot) return notFoundError('Bot not found or access denied');

		// Validate file object
		if (!file || typeof file === 'string') {
			return validationError(
				'Invalid file upload. Please select a valid file.'
			);
		}

		if (!ALLOWED_MIME_TYPES.includes(file.type)) {
			return validationError('File type is not supported.');
		}

		// create buffer from file
		const buffer = Buffer.from(await file.arrayBuffer());
		if (buffer.length > MAX_FILE_SIZE) {
			return validationError('File size exceeds the maximum limit of 50MB.');
		}

		// Verify buffer size matches file size
		if (buffer.length !== file.size) {
			console.warn('[FILE-UPLOAD] Buffer size mismatch', {
				bufferSize: buffer.length,
				fileSize: file.size,
			});
		}
		console.log('[FILE-UPLOAD] File validation passed');
		// At this point, the file is validated. Proceed to save the file and update usage.

		const result = await processFile(file, buffer, botId, userId, {
			generateEmbeddings,
			maxChunkSize,
			overlap,
		});

		// Update bot statistics efficiently using atomic operations
		try {
			await Bot.updateOne(
				{ _id: botId },
				{
					$inc: {
						fileCount: 1,
						totalTokens: result.tokensUsed || 0,
						totalEmbeddings: result.vectorsCreated || 0,
					},
					$set: {
						updatedAt: new Date(),
					},
				}
			);
			console.log('[FILE-UPLOAD] Bot statistics updated:', {
				botId: botId.toString(),
				tokensAdded: result.tokensUsed || 0,
				vectorsAdded: result.vectorsCreated || 0,
			});
		} catch (updateError) {
			console.error(
				'[FILE-UPLOAD] Failed to update bot statistics:',
				updateError
			);
			// Don't fail the entire operation if stats update fails
		}

		console.log('[FILE-UPLOAD] File processed successfully:', result);

		return apiSuccess(
			{
				fileId: result.fileId,
				fileName: file.name,
				chunksCreated: result.chunksCreated,
				vectorsCreated: result.vectorsCreated,
				tokensUsed: result.tokensUsed || 0,
				estimatedCost: result.estimatedCost || 0,
			},
			'File uploaded and processed successfully'
		);
	} catch (error) {
		console.error('File upload API error:', error);
		return serverError('Internal server error');
	}
}

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
		await connectDB();

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
