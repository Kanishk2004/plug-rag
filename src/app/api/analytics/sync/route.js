import { auth } from '@clerk/nextjs/server';
import { syncBotAnalytics } from '@/lib/analyticsSync';
import { 
  apiSuccess,
  authError,
  serverError,
  validationError
} from '@/lib/apiResponse';

/**
 * POST /api/analytics/sync - Sync bot analytics from conversations
 * Recalculates and updates bot analytics based on existing conversation data
 */
export async function POST(request) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) return authError();

    // Parse request body for optional botId
    const body = await request.json().catch(() => ({}));
    const { botId } = body;

    // Validate botId if provided
    if (botId && typeof botId !== 'string') {
      return validationError('Bot ID must be a string');
    }

    // Sync analytics
    const result = await syncBotAnalytics(botId);

    return apiSuccess(
      {
        botsUpdated: result.botsUpdated,
        syncedAt: new Date(),
        botId: botId || 'all'
      },
      `Analytics synced successfully for ${result.botsUpdated} bot(s)`
    );

  } catch (error) {
    console.error('Analytics sync API error:', error);
    return serverError('Failed to sync analytics');
  }
}