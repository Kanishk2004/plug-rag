// Confirm S3 upload completion and queue file for processing
import { auth } from '@clerk/nextjs/server';
import mongoose from 'mongoose';
import File from '@/models/File';
import connect from '@/lib/integrations/mongo';
import { addFileProcessingJob } from '@/lib/queues/fileProcessingQueue';
import { fileExistsInS3 } from '@/lib/integrations/s3.js';
import {
	apiSuccess,
	authError,
	notFoundError,
	serverError,
	validationError,
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

		// Check if file is in the correct state
		if (file.status !== 'processing') {
			return validationError(
				`File is in ${file.status} state. Expected "processing" state.`
			);
		}

		// Step 4: Verify file exists in S3
		const fileExists = await fileExistsInS3(file.s3Bucket, file.s3Key);

		if (!fileExists) {
			// Update file status to failed
			await File.findByIdAndUpdate(fileId, {
				status: 'failed',
				embeddingStatus: 'failed',
				processingError: 'File not found in S3. Upload may have failed.',
			});

			return validationError(
				'File not found in S3. Please ensure the file was uploaded successfully to the presigned URL.',
				{
					s3Key: file.s3Key,
					s3Bucket: file.s3Bucket,
					suggestion: 'Retry the upload process from /api/files/upload/init',
				}
			);
		}

		console.log('[FILE-UPLOAD-COMPLETE] S3 upload verified:', file.s3Key);
7
		// Step 5: Update file status to uploaded
		await File.findByIdAndUpdate(fileId, {
			status: 'uploaded',
		});

		// Step 6: Add file to processing queue
		await addFileProcessingJob({
			fileId: file._id.toString(),
			botId: file.botId.toString(),
			userId: file.ownerId,
			s3Key: file.s3Key,
			filename: file.filename,
			mimeType: file.mimeType,
			size: file.size,
		});

		console.log('[FILE-UPLOAD-COMPLETE] File queued for processing', {
			fileId: file._id,
			filename: file.filename,
			botId: file.botId,
		});

		// Step 6: Return success (processing happens in background)
		return apiSuccess(
			{
				fileId: file._id,
				filename: file.filename,
				status: 'queued',
				message:
					'File uploaded successfully and queued for processing. You will be notified when processing is complete.',
			},
			'File upload completed successfully'
		);
	} catch (error) {
		console.error('[FILE-UPLOAD-COMPLETE] Error:', error);
		return serverError('Failed to complete file upload');
	}
}
