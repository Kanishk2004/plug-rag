// Get presigned URL for downloading a file from S3

import { auth } from '@clerk/nextjs/server';
import connect from '@/lib/integrations/mongo';
import File from '@/models/File';
import { generatePresignedDownloadUrl } from '@/lib/integrations/s3';
import { apiSuccess, serverError } from '@/lib/utils/apiResponse';

export async function GET(request, { params }) {
	try {
		await connect();
		const { userId } = await auth();
		if (!userId) return authError();

		const fileId = (await params).id;

		// Find file
		const file = await File.findOne({ _id: fileId, ownerId: userId });
		if (!file) {
			return notFoundError('File not found or access denied');
		}

		const s3Key = file.s3Key;

		const presignedUrl = await generatePresignedDownloadUrl(s3Key, 900); // URL valid for 15 minutes

		return apiSuccess(
			{
				downloadUrl: presignedUrl,
				expiresIn: 900,
			},
			'Presigned download URL generated successfully'
		);
	} catch (error) {
		console.error('Generate presigned download URL error:', error);
		return serverError('Internal server error');
	}
}
