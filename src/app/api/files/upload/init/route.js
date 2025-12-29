// Generate a presigned upload URL for S3 and create a File record in the database
import { auth } from '@clerk/nextjs/server';
import mongoose from 'mongoose';
import Bot from '@/models/Bot';
import File from '@/models/File';
import connect from '@/lib/integrations/mongo';
import { generatePresignedUploadUrl } from '@/lib/integrations/s3';
import {
	getCurrentDBUser,
	checkUserLimitsFromUser,
} from '@/lib/integrations/clerk';
import {
	apiSuccess,
	authError,
	notFoundError,
	forbiddenError,
	serverError,
	validationError,
} from '@/lib/utils/apiResponse';
import { S3_BUCKET, S3_REGION } from '@/lib/utils/envConfig';

// File validation constants
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIME_TYPES = [
	'application/pdf',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'text/plain',
	'text/csv',
	'text/html',
	'text/markdown',
];

const MIME_TO_FILE_TYPE = {
	'application/pdf': 'pdf',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
		'docx',
	'text/plain': 'txt',
	'text/csv': 'csv',
	'text/html': 'html',
	'text/markdown': 'md',
};

export async function POST(request) {
	try {
		await connect();

		// Step 1: Authenticate user
		const { userId } = await auth();
		if (!userId) return authError();

		// Step 2: Get current user and check limits
		const user = await getCurrentDBUser(userId);
		if (!user) {
			return notFoundError('User not found');
		}

		const { limits } = checkUserLimitsFromUser(user);
		if (limits.botsReached || limits.storageReached) {
			return forbiddenError('Plan limits reached', limits);
		}

		// Step 3: Extract and validate request data
		const formData = await request.formData();
		const botIdString = formData.get('botId');
		const filename = formData.get('filename');
		const fileSize = parseInt(formData.get('fileSize'));
		const mimeType = formData.get('mimeType');

		// Validate required fields
		if (!botIdString || !filename || !fileSize || !mimeType) {
			return validationError(
				'Missing required fields: botId, filename, fileSize, mimeType'
			);
		}

		// Validate botId format
		let botId;
		try {
			botId = new mongoose.Types.ObjectId(botIdString);
		} catch (error) {
			return validationError('Invalid botId format');
		}

		// Step 4: Validate file metadata
		if (fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
			return validationError(
				`File size must be between 1 byte and ${MAX_FILE_SIZE / 1024 / 1024}MB`
			);
		}

		if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
			return validationError(
				`File type ${mimeType} is not supported. Allowed types: ${ALLOWED_MIME_TYPES.join(
					', '
				)}`
			);
		}

		const fileType = MIME_TO_FILE_TYPE[mimeType];
		if (!fileType) {
			return validationError('Unable to determine file type');
		}

		// Step 5: Validate bot ownership and configuration
		const bot = await Bot.findOne({ _id: botId, ownerId: userId });
		if (!bot) {
			return notFoundError('Bot not found or access denied');
		}

		// Validate API key configuration
		if (bot.openaiApiConfig?.keyStatus !== 'valid') {
			return forbiddenError(
				'Custom OpenAI API key required for file processing. Please configure your API key first.',
				{
					hasCustomKey: !!bot.openaiApiConfig?.apiKeyEncrypted,
					keyStatus: bot.openaiApiConfig?.keyStatus || 'none',
					requiredAction: 'Configure custom API key in bot settings',
				}
			);
		}

		// Step 6: Check bot-specific storage limits
		const currentStorage = bot.analytics?.storageUsed || 0;
		const maxStorage = bot.limits?.maxTotalStorage || 52428800; // 50MB default

		if (currentStorage + fileSize > maxStorage) {
			return forbiddenError(
				'Bot storage limit exceeded. Please delete some files or upgrade your plan.',
				{
					currentStorage,
					maxStorage,
					requestedSize: fileSize,
					available: maxStorage - currentStorage,
				}
			);
		}

		// Step 7: Generate unique S3 key
		const timestamp = Date.now();
		const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
		const s3Key = `${userId}/${botId}/${timestamp}-${sanitizedFilename}`;

		// Step 8: Create File record in database
		const fileRecord = await File.create({
			botId,
			ownerId: userId,
			filename: sanitizedFilename,
			originalName: filename,
			mimeType,
			fileType,
			size: fileSize,
			s3Key,
			s3Bucket: S3_BUCKET,
			s3Region: S3_REGION,
			storageUrl: `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${s3Key}`,
			status: 'processing',
			embeddingStatus: 'pending',
		});

		// Step 9: Generate presigned upload URL
		const uploadUrl = await generatePresignedUploadUrl(s3Key, mimeType);

		console.log('[FILE-UPLOAD-INIT] Success', {
			fileId: fileRecord._id,
			botId: botId.toString(),
			userId,
			filename: sanitizedFilename,
			size: fileSize,
		});

		// Step 10: Return presigned URL
		return apiSuccess(
			{
				uploadUrl,
				fileId: fileRecord._id,
				s3Key,
				expiresIn: 3600, // 1 hour
			},
			'Upload URL generated successfully'
		);
	} catch (error) {
		console.error('[FILE-UPLOAD-INIT] Error:', error);
		return serverError('Failed to initialize file upload');
	}
}
