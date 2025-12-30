// KEY FUNCTIONS FOR S3 INTEGRATION
// generatePresignedUloadUrl()
// downloadFile()
// deleteFile()
// generatePresignedDownloadUrl()
// fileExistsInS3()

import {
	S3Client,
	PutObjectCommand,
	GetObjectCommand,
	DeleteObjectCommand,
	HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
	AWS_ACCESS_KEY_ID,
	AWS_SECRET_ACCESS_KEY,
	S3_BUCKET,
	S3_REGION,
} from '../utils/envConfig.js';

const s3Client = new S3Client({
	region: S3_REGION,
	credentials: {
		accessKeyId: AWS_ACCESS_KEY_ID,
		secretAccessKey: AWS_SECRET_ACCESS_KEY,
	},
});
const bucket = S3_BUCKET;
const expiresIn = 3600; // 1 hour

export const generatePresignedUploadUrl = async (
	key,
	contentType,
	customExpiresIn = null
) => {
	try {
		const command = new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			ContentType: contentType,
		});

		const url = await getSignedUrl(s3Client, command, {
			expiresIn: customExpiresIn || expiresIn,
		});

		return url;
	} catch (error) {
		throw new Error(
			`Failed to generate presigned upload URL: ${error.message}`
		);
	}
};

export const downloadFile = async (key, maxRetries = 3) => {
	let lastError;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			console.log(
				`[S3-DOWNLOAD] Attempt ${attempt}/${maxRetries} - Downloading: ${key}`
			);

			const command = new GetObjectCommand({
				Bucket: bucket,
				Key: key,
			});

			const response = await s3Client.send(command);

			// Log response metadata
			const contentLength = response.ContentLength || 0;
			console.log(`[S3-DOWNLOAD] Response received:`, {
				key,
				contentType: response.ContentType,
				contentLength,
				etag: response.ETag,
			});

			// Convert stream to buffer
			const chunks = [];
			let receivedBytes = 0;

			for await (const chunk of response.Body) {
				chunks.push(chunk);
				receivedBytes += chunk.length;
			}

			const buffer = Buffer.concat(chunks);

			console.log(`[S3-DOWNLOAD] Buffer created:`, {
				key,
				expectedSize: contentLength,
				actualSize: buffer.length,
				receivedBytes,
				chunksCount: chunks.length,
			});

			// Validate buffer is not empty
			if (buffer.length === 0) {
				const emptyError = new Error(
					`Downloaded buffer is empty for S3 key: ${key}. ContentLength: ${contentLength}, Chunks: ${chunks.length}`
				);
				console.error(`[S3-DOWNLOAD] Empty buffer on attempt ${attempt}:`, {
					key,
					contentLength,
					chunksCount: chunks.length,
					attempt,
				});

				// Retry if not last attempt
				if (attempt < maxRetries) {
					lastError = emptyError;
					const delayMs = Math.pow(2, attempt) * 1000; // Exponential backoff
					console.log(`[S3-DOWNLOAD] Retrying after ${delayMs}ms...`);
					await new Promise((resolve) => setTimeout(resolve, delayMs));
					continue;
				}

				throw emptyError;
			}

			// Validate buffer size matches ContentLength (if available)
			if (contentLength > 0 && buffer.length !== contentLength) {
				console.warn(`[S3-DOWNLOAD] Size mismatch:`, {
					key,
					expected: contentLength,
					received: buffer.length,
					difference: contentLength - buffer.length,
				});
			}

			console.log(
				`[S3-DOWNLOAD] Successfully downloaded ${buffer.length} bytes from ${key}`
			);
			return buffer;
		} catch (error) {
			lastError = error;
			console.error(`[S3-DOWNLOAD] Attempt ${attempt}/${maxRetries} failed:`, {
				key,
				error: error.message,
				name: error.name,
			});

			// Don't retry on certain errors
			if (
				error.name === 'NoSuchKey' ||
				error.name === 'NotFound' ||
				error.$metadata?.httpStatusCode === 404
			) {
				throw new Error(`File not found in S3: ${key}`);
			}

			// Retry on other errors
			if (attempt < maxRetries) {
				const delayMs = Math.pow(2, attempt) * 1000; // Exponential backoff
				console.log(`[S3-DOWNLOAD] Retrying after ${delayMs}ms...`);
				await new Promise((resolve) => setTimeout(resolve, delayMs));
			} else {
				throw new Error(
					`Failed to download file from S3 after ${maxRetries} attempts: ${error.message}`
				);
			}
		}
	}

	throw lastError || new Error(`Failed to download file from S3: ${key}`);
};

export const deleteFile = async (key) => {
	try {
		const command = new DeleteObjectCommand({
			Bucket: bucket,
			Key: key,
		});

		const response = await s3Client.send(command);

		return {
			success: true,
			key: key,
			deletedAt: new Date().toISOString(),
			response: response,
		};
	} catch (error) {
		throw new Error(`Failed to delete file from S3: ${error.message}`);
	}
};

export const generatePresignedDownloadUrl = async (
	key,
	customExpiresIn = null
) => {
	try {
		const command = new GetObjectCommand({
			Bucket: bucket,
			Key: key,
		});

		const url = await getSignedUrl(s3Client, command, {
			expiresIn: customExpiresIn || expiresIn,
		});

		return url;
	} catch (error) {
		throw new Error(
			`Failed to generate presigned download URL: ${error.message}`
		);
	}
};

export async function fileExistsInS3(bucket, key) {
	try {
		const command = new HeadObjectCommand({
			Bucket: bucket,
			Key: key,
		});

		await s3Client.send(command);
		return true; // File exists
	} catch (error) {
		if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
			return false; // File doesn't exist
		}
		// Other errors (permissions, etc.)
		throw error;
	}
}
