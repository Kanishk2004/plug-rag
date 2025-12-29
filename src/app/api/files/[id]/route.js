import { auth } from '@clerk/nextjs/server';
import connect from '@/lib/integrations/mongo';
import File from '@/models/File';
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
		const url = new URL(request.url);
		const includeText = url.searchParams.get('includeText') === 'true';

		await connect();

		// Find file
		const file = await File.findOne({ _id: fileId, ownerId: userId });
		if (!file) {
			return notFoundError('File not found or access denied');
		}

		const responseData = {
			success: true,
			file: {
				id: file._id,
				filename: file.filename,
				originalName: file.originalName,
				fileType: file.fileType,
				mimeType: file.mimeType,
				size: file.size,
				status: file.status,
				totalChunks: file.totalChunks,
				embeddingStatus: file.embeddingStatus,
				vectorCount: file.vectorCount,
				embeddingTokens: file.embeddingTokens || 0,
				estimatedCost: file.estimatedCost || 0,
				processingError: file.processingError,
				embeddedAt: file.embeddedAt,
				createdAt: file.createdAt,
				processedAt: file.processedAt,
			},
		};

		// Include extracted text if requested
		if (includeText) {
			responseData.file.extractedText = file.extractedText;
		}

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
		const { userId } = await auth();
		if (!userId) {
			return authError();
		}

		const fileId = (await params).id;

		// Delete file and associated chunks using fileService
		const deletedFile = await fileService.deleteFile(fileId, userId);
		if (!deletedFile) {
			return apiError('File not found or access denied', 404);
		}

		return apiSuccess(deletedFile.data, 'File deleted successfully');
	} catch (error) {
		console.error('Delete file error:', error);
		return serverError('Internal server error');
	}
}
