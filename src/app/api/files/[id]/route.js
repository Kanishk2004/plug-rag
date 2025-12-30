import { auth } from '@clerk/nextjs/server';
import fileService from '@/lib/core/fileService';
import { apiSuccess, authError, serverError } from '@/lib/utils/apiResponse';

/**
 * GET /api/files/[id] - Get file details
 */
export async function GET(request, { params }) {
	try {
		const { userId } = await auth();
		if (!userId) {
			return authError();
		}

		const fileId = (await params).id;

		const file = await fileService.getFileById(fileId, userId);

		const responseData = {
			success: true,
			file: {
				id: file._id,
				botId: file.botId,
				filename: file.filename,
				originalName: file.originalName,
				fileType: file.fileType,
				mimeType: file.mimeType,
				size: file.size,
				status: file.status,
				processingError: file.processingError,
				s3Bucket: file.s3Bucket,
				s3Region: file.s3Region,
				storageUrl: file.storageUrl,
				embeddingStatus: file.embeddingStatus,
				totalChunks: file.totalChunks,
				embeddingTokens: file.embeddingTokens || 0,
				estimatedCost: file.estimatedCost || 0,
				embeddedAt: file.embeddedAt,
				processedAt: file.processedAt,
				createdAt: file.createdAt,
			},
		};

		return apiSuccess(responseData, 'File details retrieved successfully');
	} catch (error) {
		console.error('Get file details error:', error);
		return serverError('Internal server error');
	}
}

/**
 * DELETE /api/files/[id] - Delete a file and its associated data
 */
export async function DELETE(request, { params }) {
	try {
		// Step 1: Authenticate user
		const { userId } = await auth();
		if (!userId) {
			return authError();
		}

		// Step 2: Validate fileId
		const fileId = (await params).id;

		if (!fileId) {
			return validationError('Invalid fileId');
		}

		// Step 3: Delete file
		const deleteResult = await fileService.deleteFile(fileId, userId);

		console.log('[FILE-DELETE-API] File deleted successfully', {
			fileId,
			filename: deleteResult.data.filename,
		});

		return apiSuccess(deleteResult.data, 'File deleted successfully');
	} catch (error) {
		console.error('[FILE-DELETE-API] Error:', error);

		// Handle specific error cases
		if (error.message === 'File not found or access denied') {
			return notFoundError(error.message);
		}

		if (error.message === 'File has already been deleted') {
			return notFoundError(error.message);
		}

		return serverError(
			'Failed to delete file. Please try again or contact support.'
		);
	}
}
