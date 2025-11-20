/**
 * Admin API endpoint for testing and syncing bot analytics
 * This endpoint helps ensure data consistency across the application
 * 
 * GET /api/admin/sync-analytics?userId=xxx - Test consistency for a user
 * POST /api/admin/sync-analytics - Sync analytics for all bots or specific user
 */

import { auth } from '@clerk/nextjs/server';
import { syncBotAnalytics, getBotStatistics } from '@/lib/analyticsSync';
import { getCurrentDBUser } from '@/lib/user';
import connectDB from '@/lib/mongo';
import Bot from '@/models/Bot';
import { apiSuccess, authError, serverError, validationError } from '@/lib/apiResponse';

/**
 * GET /api/admin/sync-analytics
 * Test bot analytics consistency for debugging
 */
export async function GET(request) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) return authError();

    // Get user from database
    const user = await getCurrentDBUser(userId);
    if (!user) return authError('User not found');

    await connectDB();

    // Get all bots for this user
    const bots = await Bot.find({ ownerId: userId }).select('_id name analytics').lean();

    const testResults = [];

    for (const bot of bots) {
      // Get stored analytics
      const storedAnalytics = bot.analytics || {};
      
      // Get real-time analytics
      const realTimeStats = await getBotStatistics(bot._id);
      
      // Check consistency
      const isConsistent = (
        (storedAnalytics.totalMessages || 0) === (realTimeStats?.totalMessages || 0) &&
        (storedAnalytics.totalSessions || 0) === (realTimeStats?.totalSessions || 0)
      );

      testResults.push({
        botId: bot._id,
        botName: bot.name,
        storedAnalytics: {
          totalMessages: storedAnalytics.totalMessages || 0,
          totalSessions: storedAnalytics.totalSessions || 0,
          totalTokensUsed: storedAnalytics.totalTokensUsed || 0,
          lastActiveAt: storedAnalytics.lastActiveAt
        },
        realTimeStats: {
          totalMessages: realTimeStats?.totalMessages || 0,
          totalSessions: realTimeStats?.totalSessions || 0,
          totalTokensUsed: realTimeStats?.totalTokensUsed || 0,
          lastActiveAt: realTimeStats?.lastActiveAt
        },
        isConsistent,
        needsSync: !isConsistent
      });
    }

    const inconsistentBots = testResults.filter(r => !r.isConsistent);

    return apiSuccess({
      userId,
      totalBots: bots.length,
      consistentBots: testResults.length - inconsistentBots.length,
      inconsistentBots: inconsistentBots.length,
      testResults,
      summary: {
        allConsistent: inconsistentBots.length === 0,
        needsSync: inconsistentBots.length > 0
      }
    }, 'Analytics consistency test completed');

  } catch (error) {
    console.error('Analytics test API error:', error);
    return serverError('Failed to test analytics consistency');
  }
}

/**
 * POST /api/admin/sync-analytics
 * Sync analytics for user's bots or all bots
 */
export async function POST(request) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) return authError();

    // Get user from database
    const user = await getCurrentDBUser(userId);
    if (!user) return authError('User not found');

    const body = await request.json();
    const { syncAll = false, botIds = [] } = body;

    await connectDB();

    let botsToSync = [];

    if (syncAll) {
      // Sync all user's bots
      botsToSync = await Bot.find({ ownerId: userId }).select('_id name').lean();
    } else if (botIds.length > 0) {
      // Sync specific bots (that belong to this user)
      botsToSync = await Bot.find({ 
        _id: { $in: botIds }, 
        ownerId: userId 
      }).select('_id name').lean();
    } else {
      return validationError('Either set syncAll=true or provide botIds array');
    }

    if (botsToSync.length === 0) {
      return apiSuccess({
        syncedBots: 0,
        results: []
      }, 'No bots found to sync');
    }

    const syncResults = [];
    let successCount = 0;

    for (const bot of botsToSync) {
      try {
        const result = await syncBotAnalytics(bot._id);
        if (result.success && result.results.length > 0) {
          syncResults.push({
            botId: bot._id,
            botName: bot.name,
            success: true,
            analytics: result.results[0].analytics
          });
          successCount++;
        } else {
          syncResults.push({
            botId: bot._id,
            botName: bot.name,
            success: false,
            error: result.error || 'Unknown error'
          });
        }
      } catch (error) {
        syncResults.push({
          botId: bot._id,
          botName: bot.name,
          success: false,
          error: error.message
        });
      }
    }

    return apiSuccess({
      totalBots: botsToSync.length,
      syncedBots: successCount,
      failedBots: botsToSync.length - successCount,
      results: syncResults
    }, `Analytics sync completed: ${successCount}/${botsToSync.length} bots synced successfully`);

  } catch (error) {
    console.error('Analytics sync API error:', error);
    return serverError('Failed to sync analytics');
  }
}