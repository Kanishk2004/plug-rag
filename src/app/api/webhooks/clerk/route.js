import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import connect from '@/lib/integrations/mongo';
import User from '@/models/User.js';
import Bot from '@/models/Bot.js';
import File from '@/models/File.js';

/**
 * POST /api/webhooks/clerk - Handle Clerk webhooks
 *
 * Primarily handles user deletion cleanup since user creation/updates
 * are handled by the existing syncUserWithDB() system.
 */
export async function POST(request) {
	try {
		// Get headers for webhook verification
		const headerPayload = Object.fromEntries(request.headers);
		const svixHeaders = {
			'svix-id': headerPayload['svix-id'],
			'svix-timestamp': headerPayload['svix-timestamp'],
			'svix-signature': headerPayload['svix-signature'],
		};

		// Get webhook body
		const payload = await request.text();

		// Verify webhook signature (optional but recommended)
		let event;
		if (process.env.CLERK_WEBHOOK_SECRET) {
			const webhook = new Webhook(process.env.CLERK_WEBHOOK_SECRET);
			try {
				event = webhook.verify(payload, svixHeaders);
			} catch (error) {
				console.error('Webhook signature verification failed:', error);
				return NextResponse.json(
					{ error: 'Invalid signature' },
					{ status: 401 }
				);
			}
		} else {
			// For development/testing without webhook secret
			event = JSON.parse(payload);
			console.warn(
				'⚠️ Webhook running without signature verification (development mode)'
			);
		}

		// Connect to database
		await connect();

		console.log(
			'[CLERK-WEBHOOK] Processing event:',
			event.type,
			'for user:',
			event.data?.id
		);

		// Handle different event types
		switch (event.type) {
			case 'user.deleted':
				await handleUserDeletion(event.data.id);
				break;

			case 'user.created':
			case 'user.updated':
				// These are handled by syncUserWithDB() when user accesses the app
				console.log(
					`[CLERK-WEBHOOK] ${event.type} - will be synced on next user access`
				);
				break;

			default:
				console.log(`[CLERK-WEBHOOK] Unhandled event type: ${event.type}`);
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('Clerk webhook error:', error);
		return NextResponse.json(
			{ error: 'Webhook processing failed' },
			{ status: 500 }
		);
	}
}

/**
 * Handle user deletion - cleanup all user data
 */
async function handleUserDeletion(clerkUserId) {
	console.log(
		`[CLERK-WEBHOOK] Starting cleanup for deleted user: ${clerkUserId}`
	);

	try {
		// Find user in our database
		const user = await User.findOne({ clerkId: clerkUserId });
		if (!user) {
			console.log(
				`[CLERK-WEBHOOK] User ${clerkUserId} not found in database - nothing to clean`
			);
			return;
		}

		// 1. Delete all user's files
		const deletedFiles = await File.deleteMany({ ownerId: clerkUserId });
		console.log(
			`[CLERK-WEBHOOK] Deleted ${deletedFiles.deletedCount} files for user ${clerkUserId}`
		);

		// 2. Delete all user's bots
		const deletedBots = await Bot.deleteMany({ ownerId: clerkUserId });
		console.log(
			`[CLERK-WEBHOOK] Deleted ${deletedBots.deletedCount} bots for user ${clerkUserId}`
		);

		// 3. Delete user record
		await User.deleteOne({ clerkId: clerkUserId });
		console.log(`[CLERK-WEBHOOK] Deleted user record for ${clerkUserId}`);

		// Note: Vector collections in Qdrant could be cleaned up here
		// but would require additional logic to identify bot-specific collections
		// For now, they'll remain as orphaned collections

		console.log(
			`[CLERK-WEBHOOK] ✅ Cleanup completed for user: ${clerkUserId}`
		);
	} catch (error) {
		console.error(
			`[CLERK-WEBHOOK] ❌ Cleanup failed for user ${clerkUserId}:`,
			error
		);
		throw error;
	}
}
