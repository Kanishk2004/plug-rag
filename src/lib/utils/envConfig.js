import dotenv from 'dotenv';
dotenv.config();

// clerk Configuration
export const NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY =
	process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
export const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
export const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

// MongoDB Configuration
export const MONGODB_URI = process.env.MONGODB_URI;

// Qdrant Configuration
export const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';

// encryption Configuration (Required for API key storage)
export const ENCRYPTION_SECRET_KEY = process.env.ENCRYPTION_SECRET_KEY;

// AWS S3 Configuration
export const S3_REGION = process.env.S3_REGION;
export const S3_BUCKET = process.env.S3_BUCKET;
export const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
export const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

// redis Configuration
export const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
export const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
export const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
