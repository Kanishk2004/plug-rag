// KEY FUNCTIONS FOR S3 INTEGRATION
// generatePresignedUloadUrl()
// downloadFile()
// deleteFile()
// generatePresignedDownloadUrl()

import {
	S3Client,
	PutObjectCommand,
	GetObjectCommand,
	DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
	region: process.env.AWS_REGION,
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID,
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
	},
});
const bucket = process.env.AWS_S3_BUCKET_NAME;
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
