import mongoose from 'mongoose';
import { createQdrantClient } from '@/lib/integrations/qdrant';
import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';
import Redis from 'ioredis';
import { redisConnection } from '@/lib/queues/config';
import {
	AWS_ACCESS_KEY_ID,
	AWS_SECRET_ACCESS_KEY,
	S3_BUCKET,
	S3_REGION,
} from '@/lib/utils/envConfig';

/**
 * GET /api/health - Health check endpoint
 *
 * Industry-standard health check for monitoring and orchestration tools.
 * - Basic mode: Quick liveness check (server is running)
 * - Detailed mode (?detailed=true): Checks all service dependencies
 *
 * Response codes:
 * - 200: All services healthy
 * - 503: One or more critical services unavailable
 *
 * @param {Request} request - The request object
 * @returns {Response} Health status
 */
export async function GET(request) {
	const { searchParams } = new URL(request.url);
	const detailed = searchParams.get('detailed') === 'true';

	const timestamp = new Date().toISOString();

	// Get actual process uptime in seconds
	const uptime = Math.floor(process.uptime());

	// Get memory usage
	const memoryUsage = process.memoryUsage();
	const memory = {
		rss: formatBytes(memoryUsage.rss), // Resident Set Size - total memory allocated
		heapTotal: formatBytes(memoryUsage.heapTotal), // Total heap allocated
		heapUsed: formatBytes(memoryUsage.heapUsed), // Heap actually used
		external: formatBytes(memoryUsage.external), // C++ objects bound to JS
		arrayBuffers: formatBytes(memoryUsage.arrayBuffers || 0), // ArrayBuffers and SharedArrayBuffers
	};

	// Basic health check - just confirm server is running
	if (!detailed) {
		return Response.json(
			{
				status: 'healthy',
				timestamp,
				uptime: formatUptime(uptime),
				uptimeSeconds: uptime,
				memory,
				node: process.version,
			},
			{ status: 200 }
		);
	}

	// Detailed health check - test all service connections
	const services = await checkAllServices();

	// Determine overall status
	const criticalServices = ['mongodb', 'qdrant', 'redis'];
	const hasCriticalFailure = criticalServices.some(
		(service) => services[service]?.status === 'unhealthy'
	);

	const overallStatus = hasCriticalFailure
		? 'unhealthy'
		: Object.values(services).some((s) => s.status !== 'healthy')
		? 'degraded'
		: 'healthy';

	const statusCode = hasCriticalFailure ? 503 : 200;

	return Response.json(
		{
			status: overallStatus,
			timestamp,
			uptime: formatUptime(uptime),
			uptimeSeconds: uptime,
			memory,
			node: process.version,
			platform: process.platform,
			pid: process.pid,
			services,
		},
		{ status: statusCode }
	);
}

/**
 * Format uptime in human-readable format
 * @param {number} seconds - Uptime in seconds
 * @returns {string} Formatted uptime string
 */
function formatUptime(seconds) {
	const days = Math.floor(seconds / 86400);
	const hours = Math.floor((seconds % 86400) / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);

	const parts = [];
	if (days > 0) parts.push(`${days}d`);
	if (hours > 0) parts.push(`${hours}h`);
	if (minutes > 0) parts.push(`${minutes}m`);
	if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

	return parts.join(' ');
}

/**
 * Format bytes to human-readable format
 * @param {number} bytes - Bytes to format
 * @returns {string} Formatted bytes string
 */
function formatBytes(bytes) {
	if (bytes === 0) return '0 B';

	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Check all service connections
 * @returns {Promise<Object>} Service health status
 */
async function checkAllServices() {
	const checks = await Promise.allSettled([
		checkMongoDB(),
		checkQdrant(),
		checkS3(),
		checkRedis(),
	]);

	return {
		mongodb:
			checks[0].status === 'fulfilled' ? checks[0].value : checks[0].reason,
		qdrant:
			checks[1].status === 'fulfilled' ? checks[1].value : checks[1].reason,
		s3: checks[2].status === 'fulfilled' ? checks[2].value : checks[2].reason,
		redis:
			checks[3].status === 'fulfilled' ? checks[3].value : checks[3].reason,
	};
}

/**
 * Check MongoDB connection
 * @returns {Promise<Object>} MongoDB health status
 */
async function checkMongoDB() {
	const startTime = Date.now();
	try {
		const state = mongoose.connection.readyState;

		// If not connected, try to connect
		if (state !== 1) {
			await mongoose.connect(process.env.MONGODB_URI, {
				serverSelectionTimeoutMS: 5000,
			});
		}

		// Ping the database
		await mongoose.connection.db.admin().ping();

		const responseTime = Date.now() - startTime;

		return {
			status: 'healthy',
			responseTime,
			message: 'Connected',
		};
	} catch (error) {
		return {
			status: 'unhealthy',
			responseTime: Date.now() - startTime,
			message: error.message,
		};
	}
}

/**
 * Check Qdrant vector database connection
 * @returns {Promise<Object>} Qdrant health status
 */
async function checkQdrant() {
	const startTime = Date.now();
	try {
		const client = createQdrantClient();

		// Use a timeout wrapper
		const healthCheck = Promise.race([
			client.getCollections(),
			new Promise((_, reject) =>
				setTimeout(() => reject(new Error('Qdrant timeout')), 5000)
			),
		]);

		await healthCheck;

		const responseTime = Date.now() - startTime;

		return {
			status: 'healthy',
			responseTime,
			message: 'Connected',
		};
	} catch (error) {
		return {
			status: 'unhealthy',
			responseTime: Date.now() - startTime,
			message: error.message,
		};
	}
}

/**
 * Check S3 connection and bucket access
 * @returns {Promise<Object>} S3 health status
 */
async function checkS3() {
	const startTime = Date.now();
	try {
		const s3Client = new S3Client({
			region: S3_REGION,
			credentials: {
				accessKeyId: AWS_ACCESS_KEY_ID,
				secretAccessKey: AWS_SECRET_ACCESS_KEY,
			},
		});

		// Verify credentials by listing buckets
		const command = new ListBucketsCommand({});

		const healthCheck = Promise.race([
			s3Client.send(command),
			new Promise((_, reject) =>
				setTimeout(() => reject(new Error('S3 timeout')), 5000)
			),
		]);

		await healthCheck;

		const responseTime = Date.now() - startTime;

		return {
			status: 'healthy',
			responseTime,
			message: `Bucket: ${S3_BUCKET}`,
		};
	} catch (error) {
		return {
			status: 'unhealthy',
			responseTime: Date.now() - startTime,
			message: error.message,
		};
	}
}

/**
 * Check Redis connection for queue system
 * @returns {Promise<Object>} Redis health status
 */
async function checkRedis() {
	const startTime = Date.now();
	let redisClient = null;

	try {
		// Create a direct Redis connection to test
		redisClient = new Redis(redisConnection);

		// Verify connection with timeout
		const healthCheck = Promise.race([
			redisClient.ping(),
			new Promise((_, reject) =>
				setTimeout(() => reject(new Error('Redis timeout')), 5000)
			),
		]);

		await healthCheck;

		const responseTime = Date.now() - startTime;

		return {
			status: 'healthy',
			responseTime,
			message: 'Connected',
		};
	} catch (error) {
		return {
			status: 'unhealthy',
			responseTime: Date.now() - startTime,
			message: error.message,
		};
	} finally {
		// Clean up the Redis connection
		if (redisClient) {
			try {
				redisClient.disconnect();
			} catch (e) {
				// Ignore cleanup errors
			}
		}
	}
}
