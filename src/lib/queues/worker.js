// Worker process for file processing queue
import { Worker } from 'bullmq';
import { defaultWorkerOptions, QUEUE_NAMES } from './config.js';
import { processFileJob } from './processors/fileProcessor.js';

/**
 * File Processing Worker
 * Processes jobs from the file-processing queue
 */
const fileProcessingWorker = new Worker(
	QUEUE_NAMES.FILE_PROCESSING,
	async (job) => {
		console.log('[WORKER] Processing job:', {
			jobId: job.id,
			fileId: job.data.fileId,
			filename: job.data.filename,
			attempt: job.attemptsMade + 1,
		});

		try {
			// Update job progress
			await job.updateProgress(0);

			// Process the file (download, extract, embed)
			const result = await processFileJob(job);

			// Mark as complete
			await job.updateProgress(100);

			console.log('[WORKER] Job completed successfully:', {
				jobId: job.id,
				fileId: job.data.fileId,
			});

			return result;
		} catch (error) {
			console.error('[WORKER] Job failed:', {
				jobId: job.id,
				fileId: job.data.fileId,
				error: error.message,
				stack: error.stack,
			});
			throw error; // BullMQ will handle retries
		}
	},
	defaultWorkerOptions
);

// Event listeners for monitoring
fileProcessingWorker.on('completed', (job, result) => {
	console.log(`[WORKER] Job ${job.id} completed:`, {
		fileId: job.data.fileId,
		processingTime: Date.now() - job.timestamp,
	});
});

fileProcessingWorker.on('failed', (job, err) => {
	console.error(`[WORKER] Job ${job?.id} failed:`, {
		fileId: job?.data?.fileId,
		error: err.message,
		attempts: job?.attemptsMade,
	});
});

fileProcessingWorker.on('error', (err) => {
	console.error('[WORKER] Worker error:', err);
});

fileProcessingWorker.on('stalled', (jobId) => {
	console.warn('[WORKER] Job stalled:', jobId);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
	console.log('[WORKER] Received SIGTERM, shutting down gracefully...');
	await fileProcessingWorker.close();
	process.exit(0);
});

process.on('SIGINT', async () => {
	console.log('[WORKER] Received SIGINT, shutting down gracefully...');
	await fileProcessingWorker.close();
	process.exit(0);
});

console.log(
	'[WORKER] File processing worker started and listening for jobs...'
);

export default fileProcessingWorker;
