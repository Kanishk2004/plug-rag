// Entry point for worker - loads environment variables before importing worker
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: join(__dirname, '.env.local') });

console.log('✅ Environment variables loaded');
console.log('📦 MongoDB URI:', process.env.MONGODB_URI ? 'Found' : 'Missing');
console.log('📦 Redis Host:', process.env.REDIS_HOST || 'localhost');

// Now import and start the worker
import('./src/lib/queues/worker.js')
	.then(() => {
		console.log('🚀 Worker started successfully');
	})
	.catch((error) => {
		console.error('❌ Failed to start worker:', error);
		process.exit(1);
	});
