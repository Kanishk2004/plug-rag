// Retry file embedding processing for failed or cancelled files
import { auth } from '@clerk/nextjs/server';
import mongoose from 'mongoose';
import File from '@/models/File';
import connect from '@/lib/integrations/mongo';
import { fileExistsInS3 } from '@/lib/integrations/s3';
import {
	addFileProcessingJob,
	removeFileProcessingJob,
} from '@/lib/queues/fileProcessingQueue';
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

		console.log('[FILE-UPLOAD-RETRY] File found:', {
			fileId: file._id,
			filename: file.filename,
			status: file.status,
			embeddingStatus: file.embeddingStatus,
		});

		// Step 4: Validate file is in a retriable state
		// Allow retry for: uploaded, completed, or failed status
		const validStatusForRetry = ['uploaded', 'completed', 'failed'];

		if (!validStatusForRetry.includes(file.status)) {
			return forbiddenError(
				`File cannot be retried in current status: ${file.status}. Only uploaded, completed, or failed files can be retried.`,
				{
					currentStatus: file.status,
					currentEmbeddingStatus: file.embeddingStatus,
					validStatuses: validStatusForRetry,
					suggestion:
						file.status === 'processing'
							? 'Complete the S3 upload first using /api/files/upload/complete'
							: 'File is in an invalid state for retry',
				}
			);
		}

		// Step 5: Check if file embedding is already completed
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

		// Step 7: Verify file exists in S3 and validate metadata
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

		// Step 7a: Validate S3 file metadata to ensure file is not corrupt
		try {
			const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
			const { default: s3Client } = await import('@/lib/integrations/s3');
			const { S3Client } = await import('@aws-sdk/client-s3');
			const { S3_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } =
				await import('@/lib/utils/envConfig');

			const client = new S3Client({
				region: S3_REGION,
				credentials: {
					accessKeyId: AWS_ACCESS_KEY_ID,
					secretAccessKey: AWS_SECRET_ACCESS_KEY,
				},
			});

			const headCommand = new HeadObjectCommand({
				Bucket: file.s3Bucket,
				Key: file.s3Key,
			});

			const metadata = await client.send(headCommand);
			const s3FileSize = metadata.ContentLength || 0;

			console.log('[FILE-UPLOAD-RETRY] S3 file metadata:', {
				s3Key: file.s3Key,
				contentLength: s3FileSize,
				contentType: metadata.ContentType,
				etag: metadata.ETag,
				lastModified: metadata.LastModified,
				expectedSize: file.size,
			});

			// Validate file is not empty in S3
			if (s3FileSize === 0) {
				await File.findByIdAndUpdate(fileId, {
					status: 'failed',
					embeddingStatus: 'failed',
					processingError:
						'File in S3 has 0 bytes. File is corrupt or incomplete.',
				});

				return validationError(
					'File in S3 is empty (0 bytes). Please re-upload the file.',
					{
						s3Key: file.s3Key,
						s3Bucket: file.s3Bucket,
						s3FileSize,
						suggestion:
							'The file appears to be corrupt. Start a new upload process.',
					}
				);
			}

			// Warn if size mismatch (but allow retry to proceed)
			if (file.size && s3FileSize !== file.size) {
				console.warn('[FILE-UPLOAD-RETRY] File size mismatch detected:', {
					expectedSize: file.size,
					actualS3Size: s3FileSize,
					difference: Math.abs(file.size - s3FileSize),
				});
			}
		} catch (metadataError) {
			console.error(
				'[FILE-UPLOAD-RETRY] Failed to get S3 metadata:',
				metadataError
			);
			// Continue anyway - downloadFile will handle errors
		}

		// Step 8: Remove old failed job from queue (if exists)
		try {
			await removeFileProcessingJob(fileId);
			console.log('[FILE-UPLOAD-RETRY] Old job removed from queue');
		} catch (removeError) {
			// Job might not exist, that's okay
			console.log(
				'[FILE-UPLOAD-RETRY] No old job to remove or already removed'
			);
		}
		await addFileProcessingJob({
			fileId: file._id.toString(),
			botId: file.botId.toString(),
			userId: file.ownerId,
			s3Key: file.s3Key,
			filename: file.filename,
			mimeType: file.mimeType,
			size: file.size,
		});

		// Step 11: Update embedding status to queued
		await File.findByIdAndUpdate(fileId, {
			embeddingStatus: 'queued',
		});

		console.log('[FILE-UPLOAD-RETRY] File re-queued for processing', {
			fileId: file._id,
			filename: file.filename,
			botId: file.botId,
			previousEmbeddingStatus: file.embeddingStatus,
		});

		// Step 12: Return success response
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
