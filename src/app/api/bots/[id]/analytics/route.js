import { auth } from '@clerk/nextjs/server';
import connectDB from '@/lib/mongo';
import Bot from '@/models/Bot';
import { getBotAnalytics } from '@/lib/analyticsSync';
import { getCurrentDBUser, syncUserWithDB } from '@/lib/user';
import { 
  apiSuccess,
  authError,
  notFoundError,
  serverError,
  validationError
} from '@/lib/apiResponse';
import mongoose from 'mongoose';

/**
 * GET /api/bots/[id]/analytics - Get comprehensive bot analytics
 */
export async function GET(request, { params }) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) return authError();

    // Get and validate bot ID
    const { id: botId } = await params;
    if (!botId) return validationError('Bot ID is required');

    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(botId)) {
      return validationError('Invalid bot ID format');
    }

    // Connect to database
    await connectDB();

    // Ensure user exists in database
    let user = await getCurrentDBUser(userId);
    if (!user) {
      user = await syncUserWithDB(userId);
      if (!user) return authError('Failed to create user in DB');
    }

    // Verify bot ownership
    const bot = await Bot.findOne({
      _id: botId,
      ownerId: userId
    });

    if (!bot) {
      return notFoundError('Bot not found or access denied');
    }

    // Get comprehensive analytics
    const analytics = await getBotAnalytics(botId);

    return apiSuccess(analytics, 'Bot analytics retrieved successfully');

  } catch (error) {
    console.error('Bot analytics API error:', error);
    return serverError('Failed to retrieve bot analytics');
  }
}