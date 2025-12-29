// Retry file embedding processing for failed or cancelled files
import { auth } from '@clerk/nextjs/server';
import mongoose from 'mongoose';
import File from '@/models/File';
import connect from '@/lib/integrations/mongo';
import { fileExistsInS3 } from '@/lib/integrations/s3';
import { addFileProcessingJob } from '@/lib/queues/fileProcessingQueue';
import {
	apiSuccess,
	authError,
	notFoundError,
	serverError,
	validationError,
	forbiddenError,
} from '@/lib/utils/apiResponse';

export async function POST(request) {
	try {
		await connect();

		// Step 1: Authenticate user
		const { userId } = await auth();
		if (!userId) return authError();

		// Step 2: Get request data
		const body = await request.json();
		const { fileId } = body;

		if (!fileId) {
			return validationError('fileId is required');
		}

		// Validate fileId format
		if (!mongoose.Types.ObjectId.isValid(fileId)) {
			return validationError('Invalid fileId format');
		}

		// Step 3: Find and validate file record
		const file = await File.findOne({
			_id: fileId,
			ownerId: userId,
		});

		if (!file) {
			return notFoundError('File not found or access denied');
		}

		// Step 4: Validate file upload status
		if (file.status !== 'uploaded') {
			return forbiddenError(
				`File upload is not complete. Current status: ${file.status}. File must be uploaded to S3 before retrying embedding.`,
				{
					currentStatus: file.status,
					currentEmbeddingStatus: file.embeddingStatus,
					suggestion:
						file.status === 'initialized'
							? 'Complete the S3 upload first using /api/files/upload/complete'
							: 'File is in an invalid state for retry',
				}
			);
		}

		// Step 5: Check if file is already completed
		if (file.embeddingStatus === 'completed') {
			return forbiddenError(
				'File has already been processed successfully. No retry needed.',
				{
					fileId: file._id,
					filename: file.filename,
					embeddingStatus: file.embeddingStatus,
					processedAt: file.processedAt,
					totalChunks: file.totalChunks,
				}
			);
		}

		// Step 6: Check if file is already queued or processing
		if (
			file.embeddingStatus === 'queued' ||
			file.embeddingStatus === 'processing' ||
			file.embeddingStatus === 'retrying'
		) {
			return forbiddenError(
				`File is already being processed. Current embedding status: ${file.embeddingStatus}`,
				{
					fileId: file._id,
					filename: file.filename,
					embeddingStatus: file.embeddingStatus,
					suggestion: 'Please wait for the current processing to complete',
				}
			);
		}

		// Step 7: Verify file exists in S3
		const fileExists = await fileExistsInS3(file.s3Bucket, file.s3Key);

		if (!fileExists) {
			await File.findByIdAndUpdate(fileId, {
				status: 'failed',
				embeddingStatus: 'failed',
				processingError: 'File not found in S3. Cannot retry processing.',
			});

			return validationError(
				'File not found in S3. Please re-upload the file.',
				{
					s3Key: file.s3Key,
					s3Bucket: file.s3Bucket,
					suggestion: 'Start a new upload process from /api/files/upload/init',
				}
			);
		}

		console.log('[FILE-UPLOAD-RETRY] S3 file verified:', file.s3Key);

		// Step 8: Update file status to retrying
		await File.findByIdAndUpdate(fileId, {
			embeddingStatus: 'retrying',
			processingError: '',
		});

		// Step 9: Add file to processing queue
		await addFileProcessingJob({
			fileId: file._id.toString(),
			botId: file.botId.toString(),
			userId: file.ownerId,
			s3Key: file.s3Key,
			filename: file.filename,
			mimeType: file.mimeType,
			size: file.size,
		});

		// Step 10: Update embedding status to queued
		await File.findByIdAndUpdate(fileId, {
			embeddingStatus: 'queued',
		});

		console.log('[FILE-UPLOAD-RETRY] File re-queued for processing', {
			fileId: file._id,
			filename: file.filename,
			botId: file.botId,
			previousEmbeddingStatus: file.embeddingStatus,
		});

		// Step 11: Return success response
		return apiSuccess(
			{
				fileId: file._id,
				filename: file.filename,
				status: 'queued',
				previousEmbeddingStatus: file.embeddingStatus,
				message:
					'File re-queued for processing successfully. Processing will begin shortly.',
			},
			'File retry initiated successfully'
		);
	} catch (error) {
		console.error('[FILE-UPLOAD-RETRY] Error:', error);
		return serverError('Failed to retry file processing');
	}
}
