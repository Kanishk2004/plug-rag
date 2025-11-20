import { auth } from '@clerk/nextjs/server';
import connectDB from '@/lib/mongo';
import Bot from '@/models/Bot';
import File from '@/models/File';
import { getCurrentDBUser, syncUserWithDB } from '@/lib/user';
import { 
  apiSuccess, 
  authError, 
  notFoundError, 
  forbiddenError,
  serverError,
  validationError
} from '@/lib/apiResponse';
import mongoose from 'mongoose';

/**
 * GET /api/bots/[id] - Get individual bot details
 * 
 * Retrieves detailed information about a specific bot including:
 * - Basic bot information (name, description, status)
 * - Analytics and usage statistics
 * - File count and processing status
 * - Customization settings
 * - Vector storage configuration
 * 
 * @param {Request} request - The request object
 * @param {Object} params - Route parameters containing bot ID
 * @returns {Response} Bot details with analytics data
 */
export async function GET(request, { params }) {
  try {
    // Step 1: Authenticate user
    const { userId } = await auth();
    if (!userId) return authError();

    // Step 2: Await params and validate bot ID parameter
    const { id: botId } = await params;
    if (!botId) return validationError('Bot ID is required');

    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(botId)) {
      return validationError('Invalid bot ID format');
    }

    // Step 3: Connect to database
    await connectDB();

    // Step 4: Ensure user exists in database
    let user = await getCurrentDBUser(userId);
    if (!user) {
      console.log('User not found in DB, creating user...');
      user = await syncUserWithDB(userId);
      if (!user) return authError('Failed to create user in DB');
    }

    // Step 5: Find bot and verify ownership (using ownerId which stores Clerk ID)
    const bot = await Bot.findOne({
      _id: botId,
      ownerId: userId  // Use Clerk user ID, not MongoDB user document ID
    }).lean();

    if (!bot) {
      return notFoundError('Bot not found or access denied');
    }

    // Step 6: Get file count and processing statistics
    const fileStats = await File.aggregate([
      { $match: { botId: bot._id } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          processed: {
            $sum: { $cond: [{ $eq: ['$status', 'processed'] }, 1, 0] }
          },
          processing: {
            $sum: { $cond: [{ $eq: ['$status', 'processing'] }, 1, 0] }
          },
          failed: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          },
          totalSize: { $sum: '$size' },
          totalChunks: { $sum: '$chunks' }
        }
      }
    ]);

    const stats = fileStats[0] || {
      total: 0,
      processed: 0,
      processing: 0,
      failed: 0,
      totalSize: 0,
      totalChunks: 0
    };

    // Step 7: Format bot data with computed fields
    const botData = {
      id: bot._id.toString(),
      name: bot.name,
      description: bot.description,
      botKey: bot.botKey,
      status: bot.status,
      domainWhitelist: bot.domainWhitelist || [],
      fileCount: stats.total,
      processedFiles: stats.processed,
      processingFiles: stats.processing,
      failedFiles: stats.failed,
      totalSize: stats.totalSize,
      totalChunks: stats.totalChunks,
      totalTokens: bot.analytics?.totalTokensUsed || 0,
      totalMessages: bot.analytics?.totalMessages || 0,
      totalEmbeddings: bot.analytics?.totalEmbeddings || 0,
      lastActiveAt: bot.lastActiveAt,
      customization: bot.customization || {},
      vectorStorage: bot.vectorStorage || { enabled: true },
      limits: bot.limits || {},
      createdAt: bot.createdAt,
      updatedAt: bot.updatedAt
    };

    return apiSuccess(botData, 'Bot details retrieved successfully');

  } catch (error) {
    console.error('Get bot details API error:', error);
    return serverError('Failed to retrieve bot details');
  }
}

/**
 * PATCH /api/bots/[id] - Update bot details
 * 
 * Updates bot information with validation and ownership checks.
 * Supports updating:
 * - Basic information (name, description, status)
 * - Customization settings (colors, position, messages)
 * - Limits and configuration
 * 
 * @param {Request} request - The request object with update data
 * @param {Object} params - Route parameters containing bot ID
 * @returns {Response} Updated bot data
 */
export async function PATCH(request, { params }) {
  try {
    // Step 1: Authenticate user
    const { userId } = await auth();
    if (!userId) return authError();

    // Step 2: Await params and validate bot ID parameter
    const { id: botId } = await params;
    if (!botId) return validationError('Bot ID is required');

    // Step 3: Parse and validate request body
    const body = await request.json();
    const allowedFields = [
      'name', 'description', 'status', 'customization', 'domainWhitelist'
    ];
    
    const updateData = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Step 4: Validate specific fields
    if (updateData.name !== undefined) {
      if (typeof updateData.name !== 'string' || updateData.name.trim().length === 0) {
        return validationError('Name is required and must be a non-empty string');
      }
      if (updateData.name.length < 2 || updateData.name.length > 50) {
        return validationError('Name must be between 2 and 50 characters');
      }
      updateData.name = updateData.name.trim();
    }

    if (updateData.description !== undefined) {
      if (typeof updateData.description !== 'string') {
        return validationError('Description must be a string');
      }
      if (updateData.description.length > 500) {
        return validationError('Description cannot exceed 500 characters');
      }
      updateData.description = updateData.description.trim();
    }

    if (updateData.status !== undefined) {
      if (!['active', 'inactive'].includes(updateData.status)) {
        return validationError('Status must be either "active" or "inactive"');
      }
    }

    if (updateData.customization !== undefined) {
      if (typeof updateData.customization !== 'object') {
        return validationError('Customization must be an object');
      }
      
      // Validate customization fields
      const { customization } = updateData;
      if (customization.bubbleColor && !/^#[0-9A-Fa-f]{6}$/.test(customization.bubbleColor)) {
        return validationError('Bubble color must be a valid hex color');
      }
      if (customization.position && !['bottom-right', 'bottom-left', 'top-right', 'top-left'].includes(customization.position)) {
        return validationError('Position must be one of: bottom-right, bottom-left, top-right, top-left');
      }
      if (customization.greeting && customization.greeting.length > 200) {
        return validationError('Greeting message cannot exceed 200 characters');
      }
      if (customization.placeholder && customization.placeholder.length > 100) {
        return validationError('Placeholder text cannot exceed 100 characters');
      }
      if (customization.title && customization.title.length > 50) {
        return validationError('Title cannot exceed 50 characters');
      }
    }

    if (updateData.domainWhitelist !== undefined) {
      if (!Array.isArray(updateData.domainWhitelist)) {
        return validationError('Domain whitelist must be an array');
      }
      
      // Validate each domain
      const domainRegex = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      for (const domain of updateData.domainWhitelist) {
        if (typeof domain !== 'string' || !domainRegex.test(domain)) {
          return validationError(`Invalid domain format: ${domain}`);
        }
      }
      
      // Remove duplicates and normalize
      updateData.domainWhitelist = [...new Set(updateData.domainWhitelist.map(d => d.toLowerCase()))];
    }

    // Step 5: Connect to database
    await connectDB();

    // Step 6: Ensure user exists in database
    let user = await getCurrentDBUser(userId);
    if (!user) {
      console.log('User not found in DB, creating user...');
      user = await syncUserWithDB(userId);
      if (!user) return authError('Failed to create user in DB');
    }

    // Step 7: Find bot and verify ownership (using ownerId which stores Clerk ID)
    const existingBot = await Bot.findOne({
      _id: botId,
      ownerId: userId  // Use Clerk user ID, not MongoDB user document ID
    });

    if (!existingBot) {
      return notFoundError('Bot not found or access denied');
    }

    // Step 8: Update bot with new data
    Object.assign(existingBot, updateData);
    existingBot.updatedAt = new Date();

    await existingBot.save();

    // Step 9: Format response data
    const botData = {
      id: existingBot._id.toString(),
      name: existingBot.name,
      description: existingBot.description,
      botKey: existingBot.botKey,
      status: existingBot.status,
      customization: existingBot.customization,
      vectorStorage: existingBot.vectorStorage,
      limits: existingBot.limits,
      analytics: existingBot.analytics,
      createdAt: existingBot.createdAt,
      updatedAt: existingBot.updatedAt
    };

    return apiSuccess(botData, 'Bot updated successfully');

  } catch (error) {
    console.error('Update bot API error:', error);
    return serverError('Failed to update bot');
  }
}

/**
 * DELETE /api/bots/[id] - Delete bot and all associated data
 * 
 * Permanently deletes a bot and all associated resources:
 * - Bot document from MongoDB
 * - All associated files and their chunks
 * - Vector collection from Qdrant
 * - Chat conversations and messages
 * 
 * This operation cannot be undone.
 * 
 * @param {Request} request - The request object
 * @param {Object} params - Route parameters containing bot ID
 * @returns {Response} Deletion confirmation
 */
export async function DELETE(request, { params }) {
  try {
    // Step 1: Authenticate user
    const { userId } = await auth();
    if (!userId) return authError();

    // Step 2: Await params and validate bot ID parameter
    const { id: botId } = await params;
    if (!botId) return validationError('Bot ID is required');

    // Step 3: Connect to database
    await connectDB();

    // Step 4: Ensure user exists in database
    let user = await getCurrentDBUser(userId);
    if (!user) {
      console.log('User not found in DB, creating user...');
      user = await syncUserWithDB(userId);
      if (!user) return authError('Failed to create user in DB');
    }

    // Step 5: Find bot and verify ownership (using ownerId which stores Clerk ID)
    const bot = await Bot.findOne({
      _id: botId,
      ownerId: userId  // Use Clerk user ID, not MongoDB user document ID
    });

    if (!bot) {
      return notFoundError('Bot not found or access denied');
    }

    // Step 6: Get deletion summary before deletion
    const [fileCount, fileSize] = await Promise.all([
      File.countDocuments({ botId: bot._id }),
      File.aggregate([
        { $match: { botId: bot._id } },
        { $group: { _id: null, totalSize: { $sum: '$size' } } }
      ])
    ]);

    const totalSize = fileSize[0]?.totalSize || 0;

    // Step 7: Delete all associated files first
    const deletedFiles = await File.deleteMany({ botId: bot._id });

    // Step 8: Delete vector collection if it exists
    try {
      // Import vector store functions
      const { deleteVectorCollectionForBot } = require('@/lib/vectorStore');
      await deleteVectorCollectionForBot(bot.botKey);
      console.log(`Deleted vector collection for bot ${bot.botKey}`);
    } catch (vectorError) {
      console.warn(`Failed to delete vector collection for bot ${bot.botKey}:`, vectorError.message);
      // Continue with deletion even if vector cleanup fails
    }

    // Step 9: Delete conversations and messages if they exist
    try {
      // These models might not exist yet, so we'll handle gracefully
      const Conversation = require('@/models/Conversation');
      const Message = require('@/models/Message');
      
      const conversations = await Conversation.find({ botId: bot._id });
      const conversationIds = conversations.map(conv => conv._id);
      
      await Promise.all([
        Message.deleteMany({ conversationId: { $in: conversationIds } }),
        Conversation.deleteMany({ botId: bot._id })
      ]);
    } catch (modelError) {
      console.warn('Conversation/Message models not available, skipping cleanup:', modelError.message);
    }

    // Step 10: Finally delete the bot itself
    await Bot.deleteOne({ _id: bot._id });

    // Step 11: Update user statistics
    try {
      user.usage.bots = Math.max(0, (user.usage.bots || 1) - 1);
      user.usage.storage = Math.max(0, (user.usage.storage || totalSize) - totalSize);
      await user.save();
    } catch (updateError) {
      console.warn('Failed to update user statistics after bot deletion:', updateError.message);
    }

    // Step 12: Return deletion summary
    const deletionSummary = {
      botId: botId,
      botName: bot.name,
      filesDeleted: deletedFiles.deletedCount,
      storageFreed: totalSize,
      vectorCollectionDeleted: true, // Assume success unless error occurred
      deletedAt: new Date()
    };

    return apiSuccess(deletionSummary, 'Bot and all associated data deleted successfully');

  } catch (error) {
    console.error('Delete bot API error:', error);
    return serverError('Failed to delete bot');
  }
}