import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import connectDB from '@/lib/mongo';
import {
	getCurrentDBUser,
	updateUserUsage,
	checkUserLimitsFromUser,
} from '@/lib/user';
import mongoose from 'mongoose';
import File from '@/models/File';
import Bot from '@/models/Bot';
import { processFile } from '@/lib/fileProcessor';

// Configuration
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIME_TYPES = [
	'application/pdf',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'application/msword',
	'text/plain',
	'text/csv',
	'text/html',
];

/**
 * POST /api/files - Upload file
 */
export async function POST(request) {
	try {
		// Authentication check
		const { userId } = await auth();
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Get current user and check limits
		const user = await getCurrentDBUser(userId);
		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 });
		}

		// Check user limits using existing user object (optimized)
		const { limits } = checkUserLimitsFromUser(user);
		if (limits.botsReached || limits.storageReached) {
			return NextResponse.json(
				{ error: 'Plan limits reached', limits },
				{ status: 429 }
			);
		}

		// Parse form data
		const formData = await request.formData();
		const file = formData.get('file');
		const botIdString = formData.get('botId');

		// Parse optional upload options
		const generateEmbeddings = formData.get('generateEmbeddings') === 'true';
		const maxChunkSize = parseInt(formData.get('maxChunkSize')) || 700;
		const overlap = parseInt(formData.get('overlap')) || 100;

		// Validate required fields
		if (!file || !botIdString) {
			return NextResponse.json(
				{ error: 'File and botId are required' },
				{ status: 400 }
			);
		}

		console.log('[FILE-UPLOAD] Processing request', {
			fileName: file?.name,
			botId: botIdString,
			userId,
			fileSize: file?.size,
			generateEmbeddings,
			maxChunkSize,
			overlap,
		});

		let botId;
		try {
			botId = new mongoose.Types.ObjectId(botIdString);
		} catch (error) {
			return NextResponse.json(
				{ error: 'Invalid botId format' },
				{ status: 400 }
			);
		}

		// Validate bot ownership
		const bot = await Bot.findOne({ _id: botId, ownerId: userId });
		if (!bot) {
			return NextResponse.json(
				{ error: 'Bot not found or access denied' },
				{ status: 404 }
			);
		}
		// CODE WORKING FINE TILL HERE

		// Validate file object
		if (!file || typeof file === 'string') {
			return NextResponse.json(
				{ error: 'Invalid file upload. Please select a valid file.' },
				{ status: 400 }
			);
		}

		if (!ALLOWED_MIME_TYPES.includes(file.type)) {
			return NextResponse.json(
				{ error: 'File type is not supported.' },
				{ status: 400 }
			);
		}

		// create buffer from file
		const buffer = Buffer.from(await file.arrayBuffer());
		if (buffer.length > MAX_FILE_SIZE) {
			return NextResponse.json(
				{ error: 'File size exceeds the maximum limit of 50MB.' },
				{ status: 400 }
			);
		}

		// Verify buffer size matches file size
		if (buffer.length !== file.size) {
			console.warn('[FILE-UPLOAD] Buffer size mismatch', {
				bufferSize: buffer.length,
				fileSize: file.size,
			});
		}
		console.log('[FILE-UPLOAD] File validation passed');
		// At this point, the file is validated. Proceed to save the file and update usage.
		const result = await processFile(file, buffer, botId, userId, {
			generateEmbeddings,
			maxChunkSize,
			overlap,
		});

		console.log('[FILE-UPLOAD] File processed successfully:', result);

		return NextResponse.json({
			success: true,
			message: 'File uploaded and processed successfully',
			data: {
				fileId: result.fileId,
				fileName: file.name,
				chunksCreated: result.chunksCreated,
				vectorsCreated: result.vectorsCreated,
			}
		}, { status: 200 });
	} catch (error) {
		console.error('File upload API error:', error);
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 }
		);
	}
}
