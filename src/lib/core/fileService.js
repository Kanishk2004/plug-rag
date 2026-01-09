import File from '@/models/File';
import Bot from '@/models/Bot';
import connect from '../integrations/mongo';
import { deleteDocuments } from '../integrations/qdrant';
import { deleteFile, fileExistsInS3 } from '../integrations/s3';
import { removeFileProcessingJob } from '../queues/fileProcessingQueue';

export class FileService {
	async getFileById(fileId, ownerId) {
		await connect();

		const file = await File.findOne({ _id: fileId, ownerId: ownerId });
		if (!file) {
			throw new Error('File not found or access denied');
		}
		return file;
	}

	async deleteFile(fileId, userId) {
		await connect();

		// Step 1: Find and validate file
		const file = await File.findOne({ _id: fileId, ownerId: userId });
		if (!file) {
			throw new Error('File not found or access denied');
		}

		// Step 2: Check if file is already deleted
		if (file.status === 'deleted' && file.embeddingStatus === 'deleted') {
			throw new Error('File has already been deleted');
		}

		const deletionResults = {
			vectorDeleteCount: 0,
			s3Deleted: false,
			queueRemoved: false,
			warnings: [],
		};

		// Step 3: Remove from processing queue if queued/processing
		if (
			file.embeddingStatus === 'queued' ||
			file.embeddingStatus === 'processing' ||
			file.embeddingStatus === 'retrying'
		) {
			try {
				await removeFileProcessingJob(fileId);
				deletionResults.queueRemoved = true;
				console.log(`[FILE-DELETE] Removed from queue: ${fileId}`);
			} catch (queueError) {
				console.log(`[FILE-DELETE] Queue job not found: ${fileId}`);
			}
		}

		// Step 4: Delete vectors from Qdrant (only if completed)
		if (file.embeddingStatus === 'completed') {
			try {
				const vectorDeleteCount = await deleteDocuments(file.botId.toString(), {
					fileId: file._id.toString(),
				});
				deletionResults.vectorDeleteCount = vectorDeleteCount;
				console.log(
					`[FILE-DELETE] Deleted ${vectorDeleteCount} vectors for file ${file._id}`
				);
			} catch (vectorError) {
				const errorMsg = vectorError.message || 'Unknown error';
				console.error(
					`[FILE-DELETE] Vector deletion failed: ${errorMsg}`
				);
				
				// Track this as a warning, not a fatal error
				if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('fetch failed')) {
					deletionResults.warnings.push('Vector database unavailable - cleanup will retry later');
				} else {
					deletionResults.warnings.push(`Vector cleanup incomplete: ${errorMsg}`);
				}
				// Continue with deletion even if vector deletion fails
			}
		}

		// Step 5: Delete file from S3
		try {
			const fileExists = await fileExistsInS3(file.s3Bucket, file.s3Key);
			if (fileExists) {
				await deleteFile(file.s3Key);
				deletionResults.s3Deleted = true;
				console.log(`[FILE-DELETE] Deleted from S3: ${file.s3Key}`);
			}
		} catch (s3Error) {
			console.error(
				`[FILE-DELETE] S3 deletion failed: ${s3Error.message}`
			);
			deletionResults.warnings.push(`Storage cleanup incomplete: ${s3Error.message}`);
			// Continue with deletion even if S3 deletion fails
		}

		// Step 6: Update bot analytics
		try {
			// Fetch current bot to get accurate counts
			const bot = await Bot.findById(file.botId);
			
			if (bot) {
				const analyticsUpdate = {
					$set: {
						// Use Math.max to prevent negative values
						fileCount: Math.max(0, (bot.fileCount || 0) - 1),
						'analytics.storageUsed': Math.max(0, (bot.analytics?.storageUsed || 0) - file.size),
					},
				};

				// Only decrement embeddings if file was successfully embedded
				if (file.embeddingStatus === 'completed' && file.totalChunks > 0) {
					analyticsUpdate.$set['analytics.totalEmbeddings'] = Math.max(
						0,
						(bot.analytics?.totalEmbeddings || 0) - file.totalChunks
					);
				}

				await Bot.findByIdAndUpdate(file.botId, analyticsUpdate);
				console.log(`[FILE-DELETE] Updated bot analytics for bot ${file.botId}`);
			}
		} catch (analyticsError) {
			console.error(
				`[FILE-DELETE] Failed to update bot analytics: ${analyticsError.message}`
			);
			// Continue with deletion
		}

		// Step 7: Update file record to deleted status
		file.status = 'deleted';
		file.embeddingStatus = 'deleted';
		await file.save();

		console.log(`[FILE-DELETE] File deleted successfully: ${file._id}`);

		return {
			data: {
				id: file._id,
				filename: file.filename,
				vectorDeleteCount: deletionResults.vectorDeleteCount,
				s3Deleted: deletionResults.s3Deleted,
				queueRemoved: deletionResults.queueRemoved,
				warnings: deletionResults.warnings,
				message: deletionResults.warnings.length > 0 
					? 'File deleted with warnings - some cleanup pending'
					: 'File and associated data deleted successfully',
			},
		};
	}
}

export const fileService = new FileService();
export default fileService;
