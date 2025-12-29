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

export const downloadFile = async (key) => {
	try {
		const command = new GetObjectCommand({
			Bucket: bucket,
			Key: key,
		});

		const response = await s3Client.send(command);

		// Convert stream to buffer
		const chunks = [];
		for await (const chunk of response.Body) {
			chunks.push(chunk);
		}
		const buffer = Buffer.concat(chunks);

		return buffer;
	} catch (error) {
		throw new Error(`Failed to download file from S3: ${error.message}`);
	}
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
