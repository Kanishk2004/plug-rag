// Cancel pending file upload and delete the File record from the database
import { auth } from '@clerk/nextjs/server';
import mongoose from 'mongoose';
import File from '@/models/File';
import connect from '@/lib/integrations/mongo';
import { removeFileProcessingJob } from '@/lib/queues/fileProcessingQueue';
import {
	apiSuccess,
	authError,
	notFoundError,
	validationError,
	forbiddenError,
	serverError,
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

		// Step 4: Check if file is already completed
		if (file.embeddingStatus === 'completed') {
			return forbiddenError(
				'File has already been processed successfully. Use /api/files/[id] DELETE route to delete the file permanently.',
				{
					fileId: file._id,
					filename: file.filename,
					status: file.status,
					embeddingStatus: file.embeddingStatus,
					processedAt: file.processedAt,
					action: 'Use DELETE /api/files/' + fileId + ' to delete this file',
				}
			);
		}

		// Step 5: Check if file is already cancelled
		if (file.embeddingStatus === 'cancelled') {
			return apiSuccess(
				{
					fileId: file._id,
					filename: file.filename,
					status: 'already_cancelled',
					message: 'File upload was already cancelled',
				},
				'File already cancelled'
			);
		}

		// Step 6: Remove job from queue if it exists
		let queueJobRemoved = false;
		try {
			await removeFileProcessingJob(fileId);
			queueJobRemoved = true;
			console.log('[FILE-UPLOAD-CANCEL] Queue job removed:', fileId);
		} catch (queueError) {
			// Job might not exist in queue, that's okay
			console.log(
				'[FILE-UPLOAD-CANCEL] No queue job found or already processed:',
				fileId
			);
		}

		// Step 7: Update file status to cancelled
		await File.findByIdAndUpdate(fileId, {
			embeddingStatus: 'cancelled',
			processingError: 'Processing cancelled by user',
		});

		console.log('[FILE-UPLOAD-CANCEL] File cancelled successfully', {
			fileId: file._id,
			filename: file.filename,
			previousStatus: file.status,
			queueJobRemoved,
		});

		// Step 8: Return detailed success response
		return apiSuccess(
			{
				fileId: file._id,
				filename: file.filename,
				s3Key: file.s3Key,
				cancelled: true,
				details: {
					previousStatus: file.status,
					previousEmbeddingStatus: file.embeddingStatus,
					queueJobRemoved,
					s3FileKept: true, // File kept in S3 for potential retry
					databaseUpdated: true,
				},
				message:
					'File upload cancelled successfully. The file remains in S3 storage for potential retry.',
				retryInfo: {
					canRetry: true,
					s3Key: file.s3Key,
					note: 'You can retry uploading this file by calling /api/files/upload/complete with the same fileId',
				},
			},
			'File upload cancelled successfully'
		);
	} catch (error) {
		console.error('[FILE-UPLOAD-CANCEL] Error:', error);
		return serverError('Failed to cancel file upload');
	}
}
