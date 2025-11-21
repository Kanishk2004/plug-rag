import { currentUser } from '@clerk/nextjs/server';
import connectDB from '@/lib/mongo';
import User from '@/models/User';

/**
 * Sync current Clerk user with MongoDB (Optimized)
 * Only creates user if doesn't exist
 */
export async function syncUserWithDB(clerkId = null) {
	try {
		let userId = clerkId;
		let user = null;

		// If no clerkId provided, get current user
		if (!userId) {
			user = await currentUser();
			if (!user) {
				return null;
			}
			userId = user.id;
		}

		await connectDB();

		// Check if user exists in MongoDB (lightweight query)
		let dbUser = await User.findOne({ clerkId: userId }).lean();

		if (!dbUser) {
			// Get user data from Clerk if not already available
			if (!user) {
				user = await currentUser();
				if (!user) {
					console.error('Cannot sync user: Clerk user data not available');
					return null;
				}
			}

			// Create user with available data
			const primaryEmail = user.emailAddresses?.find(
				(email) => email.id === user.primaryEmailAddressId
			);

			const newUserData = {
				clerkId: userId,
				email: primaryEmail?.emailAddress || '',
				firstName: user.firstName || '',
				lastName: user.lastName || '',
				plan: 'free',
				usage: {
					botsCreated: 0,
					messagesThisMonth: 0,
					storageUsed: 0,
					lastResetDate: new Date(),
				},
				limits: {
					maxBots: 10,
					maxMessages: 100,
					maxStorage: 50 * 1024 * 1024, // 50MB
				},
				preferences: {
					emailNotifications: true,
					marketingEmails: false,
				},
			};

			dbUser = await User.create(newUserData);
			console.log('User synced to DB:', userId);
		}

		return dbUser;
	} catch (error) {
		console.error('Error syncing user with DB:', error);
		// Don't throw error to prevent blocking the UI
		return null;
	}
}

/**
 * Lightweight sync - only checks if user exists
 * Returns true if user exists, false if needs creation
 */
export async function checkUserExists(clerkId) {
	try {
		await connectDB();
		const exists = await User.exists({ clerkId });
		return !!exists;
	} catch (error) {
		console.error('Error checking user existence:', error);
		return false;
	}
}

/**
 * Get current user from MongoDB
 * Returns the MongoDB user document
 */
export async function getCurrentDBUser(clerkId = null) {
	try {
		let userId = clerkId;

		// If no clerkId provided, get from current user
		if (!userId) {
			const user = await currentUser();
			if (!user) {
				return null;
			}
			userId = user.id;
		}

		await connectDB();

		const dbUser = await User.findOne({ clerkId: userId });
		return dbUser;
	} catch (error) {
		console.error('Error getting current DB user:', error);
		return null;
	}
}

/**
 * Update user usage statistics
 */
export async function updateUserUsage(clerkId, updates) {
	try {
		await connectDB();

		const user = await User.findOneAndUpdate(
			{ clerkId },
			{ $inc: updates },
			{ new: true }
		);

		return user;
	} catch (error) {
		console.error('Error updating user usage:', error);
		throw error;
	}
}

/**
 * Check limits from existing user object (optimized - no DB query)
 */
export function checkUserLimitsFromUser(user) {
	if (!user) {
		throw new Error('User object is required');
	}

	const limits = {
		botsReached: user.usage.botsCreated >= user.limits.maxBots,
		messagesReached: user.usage.messagesThisMonth >= user.limits.maxMessages,
		storageReached: user.usage.storageUsed >= user.limits.maxStorage,
	};

	return {
		user,
		limits,
		hasReachedAnyLimit: Object.values(limits).some(Boolean),
	};
}
