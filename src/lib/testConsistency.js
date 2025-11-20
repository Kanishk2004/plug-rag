/**
 * Test utility to verify bot statistics consistency
 * This script can be used to manually sync analytics and test consistency
 * across different API endpoints and pages.
 */

import { syncBotAnalytics, getBotStatistics } from '@/lib/analyticsSync';
import connectDB from '@/lib/mongo';
import Bot from '@/models/Bot';

/**
 * Test consistency across different data sources
 * @param {string} userId - User ID to test bots for
 */
export async function testDataConsistency(userId) {
	try {
		await connectDB();

		console.log('🔍 Testing bot statistics consistency...\n');

		// Get user's bots
		const bots = await Bot.find({ ownerId: userId })
			.select('_id name analytics')
			.lean();

		if (bots.length === 0) {
			console.log('No bots found for user:', userId);
			return;
		}

		console.log(`Found ${bots.length} bots to test:\n`);

		for (const bot of bots) {
			console.log(`📊 Bot: ${bot.name} (${bot._id})`);
			console.log('────────────────────────────────────────');

			// Test 1: Current stored analytics
			const storedAnalytics = bot.analytics || {};
			console.log('💾 Stored Analytics:', {
				totalMessages: storedAnalytics.totalMessages || 0,
				totalSessions: storedAnalytics.totalSessions || 0,
				totalTokensUsed: storedAnalytics.totalTokensUsed || 0,
				lastActiveAt: storedAnalytics.lastActiveAt || 'Never',
			});

			// Test 2: Real-time calculated analytics
			const realTimeStats = await getBotStatistics(bot._id);
			console.log('⚡ Real-time Stats:', {
				totalMessages: realTimeStats?.totalMessages || 0,
				totalSessions: realTimeStats?.totalSessions || 0,
				totalTokensUsed: realTimeStats?.totalTokensUsed || 0,
				lastActiveAt: realTimeStats?.lastActiveAt || 'Never',
			});

			// Test 3: Compare consistency
			const isConsistent =
				(storedAnalytics.totalMessages || 0) ===
					(realTimeStats?.totalMessages || 0) &&
				(storedAnalytics.totalSessions || 0) ===
					(realTimeStats?.totalSessions || 0);

			if (isConsistent) {
				console.log('✅ Data is consistent');
			} else {
				console.log('❌ Data inconsistency detected');

				// Test 4: Sync analytics to fix inconsistency
				console.log('🔄 Syncing analytics...');
				const syncResult = await syncBotAnalytics(bot._id);
				if (syncResult.success && syncResult.results.length > 0) {
					console.log('✅ Analytics synced successfully');
					console.log('📈 Updated Analytics:', syncResult.results[0].analytics);
				} else {
					console.log('❌ Failed to sync analytics:', syncResult.error);
				}
			}

			console.log(''); // Empty line for separation
		}

		console.log('🎯 Consistency test completed!\n');

		return {
			totalBots: bots.length,
			success: true,
		};
	} catch (error) {
		console.error('❌ Error testing data consistency:', error);
		return {
			success: false,
			error: error.message,
		};
	}
}

/**
 * Sync all bots for a user to ensure consistency
 * @param {string} userId - User ID
 */
export async function syncAllUserBots(userId) {
	try {
		await connectDB();

		console.log('🔄 Syncing all bots for user:', userId);

		const bots = await Bot.find({ ownerId: userId }).select('_id name').lean();

		if (bots.length === 0) {
			console.log('No bots found to sync');
			return { success: true, botsSynced: 0 };
		}

		let syncedCount = 0;

		for (const bot of bots) {
			console.log(`Syncing bot: ${bot.name}...`);
			try {
				const result = await syncBotAnalytics(bot._id);
				if (result.success) {
					syncedCount++;
					console.log(`✅ Synced ${bot.name}`);
				} else {
					console.log(`❌ Failed to sync ${bot.name}:`, result.error);
				}
			} catch (error) {
				console.log(`❌ Error syncing ${bot.name}:`, error.message);
			}
		}

		console.log(
			`\n🎉 Sync completed: ${syncedCount}/${bots.length} bots synced`
		);

		return {
			success: true,
			totalBots: bots.length,
			botsSynced: syncedCount,
		};
	} catch (error) {
		console.error('❌ Error syncing user bots:', error);
		return {
			success: false,
			error: error.message,
		};
	}
}

/**
 * Quick test function to compare API endpoints
 */
export async function testAPIConsistency() {
	try {
		console.log('🌐 Testing API endpoint consistency...\n');

		// This would be used in a browser environment to test actual API calls
		console.log(
			'Note: This function should be called from the browser console to test live API endpoints'
		);
		console.log('Example:');
		console.log('1. Call GET /api/bots to get bot list');
		console.log('2. Call GET /api/bots/[id] for individual bots');
		console.log('3. Compare statistics between the two');
		console.log('4. All numbers should match now!');

		return { success: true };
	} catch (error) {
		console.error('❌ Error testing API consistency:', error);
		return { success: false, error: error.message };
	}
}
