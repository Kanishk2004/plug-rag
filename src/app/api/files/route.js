import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import connectDB from '@/lib/mongo';
import { getCurrentDBUser, updateUserUsage, checkUserLimits } from '@/lib/user';
import mongoose from 'mongoose';
import File from '@/models/File';
import Bot from '@/models/Bot';

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
 * GET /api/files - Get user's files
 */
export async function GET(request) {
	try {
		// Authentication check
		const { userId } = auth();
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Connect to database
		await connectDB();

		// TODO: Implement file listing logic
		return NextResponse.json(
			{ message: 'Get files endpoint - implement your logic here' },
			{ status: 501 }
		);
	} catch (error) {
		console.error('Get files API error:', error);
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 }
		);
	}
}

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

		// Connect to database
		await connectDB();

		// Get current user and check limits
		const user = await getCurrentDBUser(userId);
		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 });
		}

		// Parse form data
		const formData = await request.formData();
		const file = formData.get('file');
		const botIdString = formData.get('botId');

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
		console.log('Bot ownership verified - Develop this route further!');
    // CODE WORKING FINE TILL HERE

		// TODO: Implement file upload logic
		return NextResponse.json(
			{ message: 'File upload endpoint - implement your logic here' },
			{ status: 501 }
		);
	} catch (error) {
		console.error('File upload API error:', error);
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 }
		);
	}
}

/**
 * DELETE /api/files - Delete file
 */
export async function DELETE(request) {
	try {
		// Authentication check
		const { userId } = auth();
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Connect to database
		await connectDB();

		// TODO: Implement file deletion logic
		return NextResponse.json(
			{ message: 'Delete file endpoint - implement your logic here' },
			{ status: 501 }
		);
	} catch (error) {
		console.error('Delete file API error:', error);
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 }
		);
	}
}
