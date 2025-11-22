/**
 * Clerk Authentication Integration
 * 
 * Handles Clerk authentication integration, user synchronization,
 * and user management operations with MongoDB.
 */

import { currentUser } from '@clerk/nextjs/server';
import { logInfo, logError } from '../utils/logger.js';
import connectDB from './mongo.js';
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

		await connectDB();

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
		await connectDB();
		const exists = await User.exists({ clerkId });
		return !!exists;
	} catch (error) {
		logError('Error checking user existence', { clerkId, error: error.message });
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

		await connectDB();

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
		await connectDB();

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
 * Update user profile information
 * @param {string} clerkId - Clerk user ID
 * @param {Object} profileData - Profile data to update
 * @returns {Promise<Object>} Updated user document
 */
export async function updateUserProfile(clerkId, profileData) {
	try {
		await connectDB();

		const user = await User.findOneAndUpdate(
			{ clerkId },
			{ $set: profileData },
			{ new: true }
		);

		logInfo('Updated user profile', { clerkId });
		return user;
	} catch (error) {
		logError('Error updating user profile', { clerkId, error: error.message });
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

/**
 * Check user limits by fetching user from DB
 * @param {string} clerkId - Clerk user ID
 * @returns {Promise<Object>} Limits check result
 */
export async function checkUserLimits(clerkId) {
	try {
		const user = await getCurrentDBUser(clerkId);
		if (!user) {
			throw new Error('User not found');
		}

		return checkUserLimitsFromUser(user);
	} catch (error) {
		logError('Error checking user limits', { clerkId, error: error.message });
		throw error;
	}
}

/**
 * Reset monthly usage for a user (called on plan reset)
 * @param {string} clerkId - Clerk user ID
 * @returns {Promise<Object>} Updated user document
 */
export async function resetMonthlyUsage(clerkId) {
	try {
		await connectDB();

		const user = await User.findOneAndUpdate(
			{ clerkId },
			{ 
				$set: { 
					'usage.messagesThisMonth': 0,
					'usage.lastResetDate': new Date()
				}
			},
			{ new: true }
		);

		logInfo('Reset monthly usage', { clerkId });
		return user;
	} catch (error) {
		logError('Error resetting monthly usage', { clerkId, error: error.message });
		throw error;
	}
}

/**
 * Upgrade user plan
 * @param {string} clerkId - Clerk user ID
 * @param {string} newPlan - New plan name
 * @param {Object} newLimits - New plan limits
 * @returns {Promise<Object>} Updated user document
 */
export async function upgradeUserPlan(clerkId, newPlan, newLimits) {
	try {
		await connectDB();

		const user = await User.findOneAndUpdate(
			{ clerkId },
			{ 
				$set: { 
					plan: newPlan,
					limits: newLimits,
					'usage.lastResetDate': new Date()
				}
			},
			{ new: true }
		);

		logInfo('Upgraded user plan', { clerkId, newPlan });
		return user;
	} catch (error) {
		logError('Error upgrading user plan', { clerkId, error: error.message });
		throw error;
	}
}

/**
 * Get user statistics for analytics
 * @param {string} clerkId - Clerk user ID
 * @returns {Promise<Object>} User statistics
 */
export async function getUserStats(clerkId) {
	try {
		const user = await getCurrentDBUser(clerkId);
		if (!user) {
			throw new Error('User not found');
		}

		return {
			plan: user.plan,
			usage: user.usage,
			limits: user.limits,
			utilizationPercentage: {
				bots: (user.usage.botsCreated / user.limits.maxBots) * 100,
				messages: (user.usage.messagesThisMonth / user.limits.maxMessages) * 100,
				storage: (user.usage.storageUsed / user.limits.maxStorage) * 100
			},
			joinedAt: user.createdAt,
			lastResetDate: user.usage.lastResetDate
		};
	} catch (error) {
		logError('Error getting user stats', { clerkId, error: error.message });
		throw error;
	}
}