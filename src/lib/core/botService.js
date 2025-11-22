/**
 * Bot Service
 * 
 * Core business logic for bot management including CRUD operations,
 * bot configuration, status management, and bot-specific operations.
 */

import { logInfo, logError } from '../utils/logger.js';
import { createPerformanceTimer } from '../utils/performance.js';
import connectDB from '../integrations/mongo.js';
import Bot from '@/models/Bot.js';

/**
 * Custom error class for bot-related errors
 */
export class BotError extends Error {
  constructor(message, status = 400, code = null) {
    super(message);
    this.name = 'BotError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Create a new bot
 * @param {Object} botData - Bot creation data
 * @param {string} userId - User ID creating the bot
 * @returns {Promise<Object>} Created bot data
 */
export async function createBot(botData, userId) {
  const timer = createPerformanceTimer('Bot Creation');

  try {
    if (!botData.name || !userId) {
      throw new BotError('Bot name and user ID are required', 400);
    }

    logInfo('Creating new bot', { 
      userId, 
      botName: botData.name,
      hasApiKey: !!botData.openaiApiKey
    });

    await connectDB();

    // Check if user already has a bot with this name
    const existingBot = await Bot.findOne({ 
      userId, 
      name: botData.name 
    });

    if (existingBot) {
      throw new BotError(`Bot with name "${botData.name}" already exists`, 409);
    }

    // Prepare bot data
    const newBotData = {
      userId,
      name: botData.name.trim(),
      description: botData.description?.trim() || '',
      status: 'active',
      model: botData.model || 'gpt-3.5-turbo',
      embeddingModel: botData.embeddingModel || 'text-embedding-3-small',
      createdAt: new Date(),
      updatedAt: new Date(),
      apiConfiguration: {
        fallbackToGlobal: botData.fallbackToGlobal !== false,
        openaiConfig: {
          keyStatus: 'none',
          models: {
            chat: botData.model || 'gpt-3.5-turbo',
            embeddings: botData.embeddingModel || 'text-embedding-3-small'
          }
        }
      },
      statistics: {
        messagesCount: 0,
        filesCount: 0,
        vectorsCount: 0,
        lastUsed: null
      }
    };

    // Create the bot
    const bot = await Bot.create(newBotData);

    const duration = timer.end({ success: true, botId: bot._id });

    logInfo('Bot created successfully', {
      userId,
      botId: bot._id,
      botName: bot.name,
      duration: `${duration}ms`
    });

    return {
      success: true,
      bot: bot.toObject()
    };
  } catch (error) {
    timer.end({ success: false, error: error.message });
    
    if (error instanceof BotError) {
      throw error;
    }

    logError('Bot creation failed', {
      userId,
      botName: botData?.name,
      error: error.message
    });

    throw new BotError(`Failed to create bot: ${error.message}`, 500);
  }
}

/**
 * Get user's bots with optional filtering
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} User's bots
 */
export async function getUserBots(userId, options = {}) {
  try {
    const {
      status = null,
      search = '',
      page = 1,
      limit = 10,
      sortBy = 'updatedAt',
      sortOrder = 'desc'
    } = options;

    logInfo('Fetching user bots', { 
      userId, 
      status, 
      search: search ? `"${search}"` : null,
      page,
      limit
    });

    await connectDB();

    // Build query
    const query = { userId };

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const [bots, total] = await Promise.all([
      Bot.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Bot.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    logInfo('User bots retrieved', {
      userId,
      botsCount: bots.length,
      totalBots: total,
      page,
      totalPages
    });

    return {
      success: true,
      data: {
        items: bots,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    };
  } catch (error) {
    logError('Failed to fetch user bots', { userId, error: error.message });
    throw new BotError(`Failed to fetch bots: ${error.message}`, 500);
  }
}

/**
 * Get bot by ID with ownership validation
 * @param {string} botId - Bot ID
 * @param {string} userId - User ID for ownership validation
 * @returns {Promise<Object>} Bot data
 */
export async function getBotById(botId, userId) {
  try {
    if (!botId) {
      throw new BotError('Bot ID is required', 400);
    }

    logInfo('Fetching bot by ID', { botId, userId });

    await connectDB();

    const bot = await Bot.findOne({ _id: botId, userId }).lean();

    if (!bot) {
      throw new BotError('Bot not found or access denied', 404);
    }

    logInfo('Bot retrieved successfully', { 
      botId, 
      botName: bot.name,
      status: bot.status
    });

    return {
      success: true,
      data: bot
    };
  } catch (error) {
    if (error instanceof BotError) {
      throw error;
    }

    logError('Failed to fetch bot', { botId, userId, error: error.message });
    throw new BotError(`Failed to fetch bot: ${error.message}`, 500);
  }
}

/**
 * Update bot configuration
 * @param {string} botId - Bot ID
 * @param {string} userId - User ID for ownership validation
 * @param {Object} updates - Update data
 * @returns {Promise<Object>} Updated bot data
 */
export async function updateBot(botId, userId, updates) {
  const timer = createPerformanceTimer('Bot Update');

  try {
    if (!botId || !userId) {
      throw new BotError('Bot ID and User ID are required', 400);
    }

    logInfo('Updating bot', { 
      botId, 
      userId,
      updatedFields: Object.keys(updates)
    });

    await connectDB();

    // Verify bot exists and user owns it
    const existingBot = await Bot.findOne({ _id: botId, userId });

    if (!existingBot) {
      throw new BotError('Bot not found or access denied', 404);
    }

    // Prepare update data
    const updateData = {
      ...updates,
      updatedAt: new Date()
    };

    // Remove sensitive fields that shouldn't be updated directly
    delete updateData._id;
    delete updateData.userId;
    delete updateData.createdAt;
    delete updateData.statistics;

    // Update the bot
    const updatedBot = await Bot.findByIdAndUpdate(
      botId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).lean();

    const duration = timer.end({ success: true, botId });

    logInfo('Bot updated successfully', {
      botId,
      userId,
      updatedFields: Object.keys(updates),
      duration: `${duration}ms`
    });

    return {
      success: true,
      data: updatedBot
    };
  } catch (error) {
    timer.end({ success: false, error: error.message });

    if (error instanceof BotError) {
      throw error;
    }

    logError('Bot update failed', { 
      botId, 
      userId, 
      error: error.message 
    });

    throw new BotError(`Failed to update bot: ${error.message}`, 500);
  }
}

/**
 * Toggle bot status (active/inactive)
 * @param {string} botId - Bot ID
 * @param {string} userId - User ID for ownership validation
 * @returns {Promise<Object>} Updated bot data
 */
export async function toggleBotStatus(botId, userId) {
  try {
    logInfo('Toggling bot status', { botId, userId });

    const bot = await getBotById(botId, userId);
    const newStatus = bot.data.status === 'active' ? 'inactive' : 'active';

    const result = await updateBot(botId, userId, { status: newStatus });

    logInfo('Bot status toggled', { 
      botId, 
      oldStatus: bot.data.status,
      newStatus 
    });

    return result;
  } catch (error) {
    logError('Failed to toggle bot status', { 
      botId, 
      userId, 
      error: error.message 
    });
    throw error;
  }
}

/**
 * Delete bot and all associated data
 * @param {string} botId - Bot ID
 * @param {string} userId - User ID for ownership validation
 * @returns {Promise<Object>} Deletion summary
 */
export async function deleteBot(botId, userId) {
  const timer = createPerformanceTimer('Bot Deletion');

  try {
    if (!botId || !userId) {
      throw new BotError('Bot ID and User ID are required', 400);
    }

    logInfo('Deleting bot', { botId, userId });

    await connectDB();

    // Verify bot exists and user owns it
    const bot = await Bot.findOne({ _id: botId, userId });

    if (!bot) {
      throw new BotError('Bot not found or access denied', 404);
    }

    // TODO: Add cleanup of associated data
    // - Delete files associated with this bot
    // - Delete vector embeddings from Qdrant
    // - Delete conversation history
    // - Delete analytics events

    // Delete the bot
    await Bot.findByIdAndDelete(botId);

    const duration = timer.end({ success: true, botId });

    logInfo('Bot deleted successfully', {
      botId,
      userId,
      botName: bot.name,
      duration: `${duration}ms`
    });

    return {
      success: true,
      data: {
        deletedBot: {
          id: botId,
          name: bot.name
        },
        // TODO: Add cleanup summary
        cleanupSummary: {
          filesDeleted: 0,
          vectorsDeleted: 0,
          conversationsDeleted: 0
        }
      }
    };
  } catch (error) {
    timer.end({ success: false, error: error.message });

    if (error instanceof BotError) {
      throw error;
    }

    logError('Bot deletion failed', { 
      botId, 
      userId, 
      error: error.message 
    });

    throw new BotError(`Failed to delete bot: ${error.message}`, 500);
  }
}

/**
 * Update bot statistics
 * @param {string} botId - Bot ID
 * @param {Object} statUpdates - Statistics updates (using MongoDB increment syntax)
 * @returns {Promise<Object>} Updated bot
 */
export async function updateBotStats(botId, statUpdates) {
  try {
    await connectDB();

    const bot = await Bot.findByIdAndUpdate(
      botId,
      {
        $inc: statUpdates,
        $set: { 
          'statistics.lastUsed': new Date(),
          updatedAt: new Date()
        }
      },
      { new: true }
    );

    logInfo('Bot statistics updated', { 
      botId, 
      updates: statUpdates 
    });

    return bot;
  } catch (error) {
    logError('Failed to update bot statistics', { 
      botId, 
      error: error.message 
    });
    throw error;
  }
}

/**
 * Get bot usage analytics
 * @param {string} botId - Bot ID
 * @param {string} userId - User ID for ownership validation
 * @returns {Promise<Object>} Bot analytics
 */
export async function getBotAnalytics(botId, userId) {
  try {
    const bot = await getBotById(botId, userId);
    
    return {
      success: true,
      data: {
        basicStats: bot.data.statistics,
        // TODO: Add more comprehensive analytics
        // - Message count by date
        // - File processing history
        // - Usage patterns
        // - Cost tracking
      }
    };
  } catch (error) {
    logError('Failed to get bot analytics', { 
      botId, 
      userId, 
      error: error.message 
    });
    throw error;
  }
}