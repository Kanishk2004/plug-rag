import { currentUser } from '@clerk/nextjs/server';
import connectDB from '@/lib/mongo';
import User from '@/models/User';
import { PerformanceMonitor } from '@/lib/performance';

/**
 * Sync current Clerk user with MongoDB (Optimized)
 * Only creates user if doesn't exist, with caching
 */
export async function syncUserWithDB() {
  try {
    const user = await currentUser();
    
    if (!user) {
      return null;
    }

    await connectDB();

    // Check if user exists in MongoDB (lightweight query)
    let dbUser = await User.findOne({ clerkId: user.id }).lean();

    if (!dbUser) {
      // Create user if doesn't exist
      const primaryEmail = user.emailAddresses.find(
        email => email.id === user.primaryEmailAddressId
      );

      const newUserData = {
        clerkId: user.id,
        email: primaryEmail?.emailAddress || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        plan: 'free',
        subscription: {
          status: 'inactive',
        },
        usage: {
          botsCreated: 0,
          messagesThisMonth: 0,
          storageUsed: 0,
          lastResetDate: new Date(),
        },
        limits: {
          maxBots: 1,
          maxMessages: 100,
          maxStorage: 50 * 1024 * 1024, // 50MB
        },
        preferences: {
          emailNotifications: true,
          marketingEmails: false,
        },
      };

      dbUser = await User.create(newUserData);
      console.log('User synced to DB:', user.id);
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
    PerformanceMonitor.startTimer('checkUserExists');
    await connectDB();
    const exists = await User.exists({ clerkId });
    PerformanceMonitor.endTimer('checkUserExists');
    return !!exists;
  } catch (error) {
    PerformanceMonitor.endTimer('checkUserExists', 'error');
    console.error('Error checking user existence:', error);
    return false;
  }
}

/**
 * Async user sync - non-blocking
 * Creates user in background without blocking UI
 */
export async function asyncSyncUser(clerkId) {
  // Run in background without blocking
  setTimeout(async () => {
    try {
      const user = await currentUser();
      if (user && user.id === clerkId) {
        await syncUserWithDB();
      }
    } catch (error) {
      console.error('Background user sync failed:', error);
    }
  }, 0);
}

/**
 * Get current user from MongoDB
 * Returns the MongoDB user document
 */
export async function getCurrentDBUser() {
  try {
    const user = await currentUser();
    
    if (!user) {
      return null;
    }

    await connectDB();
    
    const dbUser = await User.findOne({ clerkId: user.id });
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
 * Check if user has reached their plan limits
 */
export async function checkUserLimits(clerkId) {
  try {
    await connectDB();
    
    const user = await User.findOne({ clerkId });
    
    if (!user) {
      throw new Error('User not found');
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
  } catch (error) {
    console.error('Error checking user limits:', error);
    throw error;
  }
}