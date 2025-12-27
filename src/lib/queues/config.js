// Redis connection configuration for queues

/**
 * Redis connection configuration
 * Uses local Redis from Docker Compose by default
 */
export const redisConnection = {
	host: process.env.REDIS_HOST || 'localhost',
	port: parseInt(process.env.REDIS_PORT || '6379'),
	password: process.env.REDIS_PASSWORD || undefined,
	maxRetriesPerRequest: null, // Required for BullMQ
	enableReadyCheck: false,
	retryStrategy: (times) => {
		const delay = Math.min(times * 50, 2000);
		return delay;
	},
};

/**
 * Default queue options
 */
export const defaultQueueOptions = {
	connection: redisConnection,
	defaultJobOptions: {
		attempts: 3, // Retry failed jobs 3 times
		backoff: {
			type: 'exponential',
			delay: 5000, // Start with 5 second delay
		},
		removeOnComplete: {
			age: 24 * 3600, // Keep completed jobs for 24 hours
			count: 1000, // Keep max 1000 completed jobs
		},
		removeOnFail: {
			age: 7 * 24 * 3600, // Keep failed jobs for 7 days
		},
	},
};

/**
 * Worker options configuration
 */
export const defaultWorkerOptions = {
	connection: redisConnection,
	concurrency: 5, // Process 5 jobs concurrently
	limiter: {
		max: 10, // Max 10 jobs
		duration: 1000, // Per second
	},
};

/**
 * Queue names
 */
export const QUEUE_NAMES = {
	FILE_PROCESSING: 'file-processing',
};
