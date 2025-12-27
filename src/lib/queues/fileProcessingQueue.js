// For queue instance and job producer functions
import { Queue } from 'bullmq';
import { defaultQueueOptions, QUEUE_NAMES } from './config.js';

/**
 * File Processing Queue Instance
 * Handles file upload, text extraction, and embedding generation
 */
export const fileProcessingQueue = new Queue(
	QUEUE_NAMES.FILE_PROCESSING,
	defaultQueueOptions
);

/**
 * Job data structure for file processing
 * @typedef {Object} FileProcessingJobData
 * @property {string} fileId - MongoDB File document ID
 * @property {string} botId - Bot ID
 * @property {string} userId - Owner user ID
 * @property {string} s3Key - S3 object key
 * @property {string} filename - Original filename
 * @property {string} mimeType - File MIME type
 * @property {number} size - File size in bytes
 */

/**
 * Add a file processing job to the queue
 * @param {FileProcessingJobData} jobData - File processing job data
 * @param {Object} options - Additional job options
 * @returns {Promise<Job>} BullMQ Job instance
 */
export async function addFileProcessingJob(jobData, options = {}) {
	try {
		const job = await fileProcessingQueue.add('process-file', jobData, {
			jobId: jobData.fileId, // Use fileId as job ID to prevent duplicates
			priority: options.priority || 1, // Lower number = higher priority
			...options,
		});

		console.log('[QUEUE] File processing job added:', {
			jobId: job.id,
			fileId: jobData.fileId,
			filename: jobData.filename,
		});

		return job;
	} catch (error) {
		console.error('[QUEUE] Error adding file processing job:', error);
		throw error;
	}
}

/**
 * Get job status by file ID
 * @param {string} fileId - File document ID
 * @returns {Promise<Object>} Job status information
 */
export async function getFileProcessingJobStatus(fileId) {
	try {
		const job = await fileProcessingQueue.getJob(fileId);

		if (!job) {
			return { status: 'not_found' };
		}

		const state = await job.getState();
		const progress = job.progress;

		return {
			status: state,
			progress,
			data: job.data,
			failedReason: job.failedReason,
			finishedOn: job.finishedOn,
			processedOn: job.processedOn,
		};
	} catch (error) {
		console.error('[QUEUE] Error getting job status:', error);
		throw error;
	}
}

/**
 * Remove a job from the queue
 * @param {string} fileId - File document ID
 * @returns {Promise<void>}
 */
export async function removeFileProcessingJob(fileId) {
	try {
		const job = await fileProcessingQueue.getJob(fileId);

		if (job) {
			await job.remove();
			console.log('[QUEUE] Job removed:', fileId);
		}
	} catch (error) {
		console.error('[QUEUE] Error removing job:', error);
		throw error;
	}
}

/**
 * Get queue metrics
 * @returns {Promise<Object>} Queue statistics
 */
export async function getQueueMetrics() {
	try {
		const [waiting, active, completed, failed, delayed] = await Promise.all([
			fileProcessingQueue.getWaitingCount(),
			fileProcessingQueue.getActiveCount(),
			fileProcessingQueue.getCompletedCount(),
			fileProcessingQueue.getFailedCount(),
			fileProcessingQueue.getDelayedCount(),
		]);

		return {
			waiting,
			active,
			completed,
			failed,
			delayed,
			total: waiting + active + completed + failed + delayed,
		};
	} catch (error) {
		console.error('[QUEUE] Error getting queue metrics:', error);
		throw error;
	}
}
