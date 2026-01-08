/**
 * Clerk Authentication Integration
 *
 * Handles Clerk authentication integration, user synchronization,
 * and user management operations with MongoDB.
 */

import { currentUser } from '@clerk/nextjs/server';
import { logInfo, logError } from '../utils/logger.js';
import connect from './mongo.js';
import User from '@/models/User.js';

/**
 * Get current authenticated user from Clerk
 * @returns {Promise<Object|null>} Current user or null if not authenticated
 */
export async function getCurrentClerkUser() {
	try {
		const user = await currentUser();
		if (user) {
			logInfo('Retrieved current Clerk user', { userId: user.id });
		}
		return user;
	} catch (error) {
		logError('Failed to get current Clerk user', { error: error.message });
		return null;
	}
}

/**
 * Sync current Clerk user with MongoDB (Optimized)
 * Only creates user if doesn't exist
 * @param {string} clerkId - Optional Clerk user ID
 * @returns {Promise<Object|null>} MongoDB user document
 */
export async function syncUserWithDB(clerkId = null) {
	try {
		let userId = clerkId;
		let user = null;

		// If no clerkId provided, get current user
		if (!userId) {
			user = await getCurrentClerkUser();
			if (!user) {
				return null;
			}
			userId = user.id;
		}

		await connect();

		// Check if user exists in MongoDB (lightweight query)
		let dbUser = await User.findOne({ clerkId: userId }).lean();

		if (!dbUser) {
			// Get user data from Clerk if not already available
			if (!user) {
				user = await getCurrentClerkUser();
				if (!user) {
					logError('Cannot sync user: Clerk user data not available');
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
				limits: {
					maxBots: 10,
				},
			};

			dbUser = await User.create(newUserData);
			logInfo('User synced to DB', { userId, email: newUserData.email });
		}

		return dbUser;
	} catch (error) {
		logError('Error syncing user with DB', { error: error.message });
		// Don't throw error to prevent blocking the UI
		return null;
	}
}

/**
 * Lightweight sync - only checks if user exists
 * Returns true if user exists, false if needs creation
 * @param {string} clerkId - Clerk user ID
 * @returns {Promise<boolean>} Whether user exists in DB
 */
export async function checkUserExists(clerkId) {
	try {
		await connect();
		const exists = await User.exists({ clerkId });
		return !!exists;
	} catch (error) {
		logError('Error checking user existence', {
			clerkId,
			error: error.message,
		});
		return false;
	}
}

/**
 * Get current user from MongoDB
 * Returns the MongoDB user document
 * @param {string} clerkId - Optional Clerk user ID
 * @returns {Promise<Object|null>} MongoDB user document
 */
export async function getCurrentDBUser(clerkId = null) {
	try {
		let userId = clerkId;

		// If no clerkId provided, get from current user
		if (!userId) {
			const user = await getCurrentClerkUser();
			if (!user) {
				return null;
			}
			userId = user.id;
		}

		await connect();

		const dbUser = await User.findOne({ clerkId: userId });
		logInfo('Retrieved DB user', { userId, found: !!dbUser });
		return dbUser;
	} catch (error) {
		logError('Error getting current DB user', { error: error.message });
		return null;
	}
}

/**
 * Update user usage statistics
 * @param {string} clerkId - Clerk user ID
 * @param {Object} updates - Usage updates (using MongoDB $inc syntax)
 * @returns {Promise<Object>} Updated user document
 */
export async function updateUserUsage(clerkId, updates) {
	try {
		await connect();

		const user = await User.findOneAndUpdate(
			{ clerkId },
			{ $inc: updates },
			{ new: true }
		);

		logInfo('Updated user usage', { clerkId, updates });
		return user;
	} catch (error) {
		logError('Error updating user usage', { clerkId, error: error.message });
		throw error;
	}
}

/**
 * Check limits from existing user object (optimized - no DB query)
 * @param {Object} user - User document from MongoDB
 * @returns {Object} Limits check result
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


