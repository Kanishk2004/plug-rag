import Bot from '@/models/Bot';
import connectDB from '@/lib/mongo';

let Conversation, Message, modelsAvailable = null;

// Lazy load models to handle cases where they might not exist
async function getModels() {
  if (modelsAvailable === null) {
    try {
      // Use dynamic imports instead of require for Next.js compatibility
      const ConversationModule = await import('@/models/Conversation');
      const MessageModule = await import('@/models/Message');
      
      Conversation = ConversationModule.default;
      Message = MessageModule.default;
      modelsAvailable = true;
      console.log('✅ Conversation and Message models loaded successfully');
    } catch (error) {
      console.warn('⚠️ Conversation/Message models not available. Using fallback analytics.', error.message);
      modelsAvailable = false;
      return null;
    }
  }
  
  if (modelsAvailable) {
    return { Conversation, Message };
  }
  
  return null;
}

/**
 * Get fallback analytics when Conversation/Message models are not available
 * Uses existing bot analytics data and file counts as approximation
 */
async function getFallbackAnalytics(bot) {
  try {
    // Import File model for file-based statistics using dynamic import
    const FileModule = await import('@/models/File');
    const File = FileModule.default;
    
    // Get file statistics
    const fileStats = await File.aggregate([
      { $match: { botId: bot._id } },
      {
        $group: {
          _id: null,
          totalFiles: { $sum: 1 },
          totalSize: { $sum: '$size' },
          avgFileSize: { $avg: '$size' }
        }
      }
    ]);
    
    const stats = fileStats[0] || { totalFiles: 0, totalSize: 0, avgFileSize: 0 };
    
    // Use existing analytics if available, or create basic estimates
    const existingAnalytics = bot.analytics || {};
    
    return {
      totalMessages: existingAnalytics.totalMessages || 0,
      totalSessions: existingAnalytics.totalSessions || 0,
      totalTokensUsed: existingAnalytics.totalTokensUsed || 0,
      totalEmbeddings: stats.totalFiles || 0, // Use file count as embedding estimate
      lastActiveAt: existingAnalytics.lastActiveAt || bot.updatedAt,
      // Additional info for debugging
      _fallbackUsed: true,
      _fileStats: stats
    };
  } catch (error) {
    console.warn('Error getting fallback analytics:', error.message);
    return {
      totalMessages: 0,
      totalSessions: 0,
      totalTokensUsed: 0,
      totalEmbeddings: 0,
      lastActiveAt: bot.updatedAt || bot.createdAt,
      _fallbackUsed: true,
      _error: error.message
    };
  }
}

/**
 * Sync bot analytics from existing conversations and messages
 * This function recalculates analytics for bots based on their actual data
 * Useful for updating analytics on existing bots that may have incomplete data
 */
export async function syncBotAnalytics(botId = null, options = {}) {
  const { saveToDatabase = true, includeTokens = true } = options;
  
  try {
    await connectDB();

    // Get models
    const models = await getModels();
    
    // If models not available, use fallback method
    if (!models) {
      return await syncBotAnalyticsFallback(botId, options);
    }
    
    const { Conversation, Message } = models;

    // If botId is provided, sync only that bot, otherwise sync all bots
    const filter = botId ? { _id: botId } : {};
    const bots = await Bot.find(filter);

    console.log(`Syncing analytics for ${bots.length} bot(s)...`);
    const results = [];

    for (const bot of bots) {
      try {
        // Get real counts from database
        const [
          conversationCount,
          messageStats,
          lastActivity
        ] = await Promise.all([
          // Count total conversations for this bot
          Conversation.countDocuments({ botId: bot._id }),
          
          // Count total messages and get total tokens
          // Try Message model first, then fall back to embedded messages in conversations
          Message.countDocuments({ botId: bot._id }).then(async (messageCount) => {
            if (messageCount > 0) {
              // Use separate Message collection
              const tokenStats = await Message.aggregate([
                { $match: { botId: bot._id } },
                {
                  $group: {
                    _id: null,
                    totalMessages: { $sum: 1 },
                    totalTokens: { $sum: { $ifNull: ['$metadata.totalTokens', 0] } }
                  }
                }
              ]);
              return tokenStats[0] || { totalMessages: messageCount, totalTokens: 0 };
            } else {
              // Fall back to embedded messages in conversations
              const conversationStats = await Conversation.aggregate([
                { $match: { botId: bot._id } },
                {
                  $group: {
                    _id: null,
                    totalMessages: { $sum: '$totalMessages' },
                    totalTokens: { $sum: '$totalTokens' }
                  }
                }
              ]);
              return conversationStats[0] || { totalMessages: 0, totalTokens: 0 };
            }
          }),
          
          // Get last activity from most recent message or conversation
          Promise.all([
            Message.findOne({ botId: bot._id }, { createdAt: 1 }).sort({ createdAt: -1 }).lean(),
            Conversation.findOne({ botId: bot._id }, { lastMessageAt: 1 }).sort({ lastMessageAt: -1 }).lean()
          ]).then(([latestMessage, latestConversation]) => {
            const messageDate = latestMessage?.createdAt;
            const conversationDate = latestConversation?.lastMessageAt;
            
            if (messageDate && conversationDate) {
              return messageDate > conversationDate ? { createdAt: messageDate } : { createdAt: conversationDate };
            } else if (messageDate) {
              return { createdAt: messageDate };
            } else if (conversationDate) {
              return { createdAt: conversationDate };
            }
            return null;
          })
        ]);
        
        // Extract values
        const totalMessages = messageStats?.totalMessages || 0;
        const totalTokens = messageStats?.totalTokens || 0;
        const lastActiveAt = lastActivity?.createdAt || bot.updatedAt;
        
        // Build updated analytics
        const updatedAnalytics = {
          totalMessages,
          totalSessions: conversationCount,
          totalTokensUsed: includeTokens ? totalTokens : (bot.analytics?.totalTokensUsed || 0),
          totalEmbeddings: bot.analytics?.totalEmbeddings || 0, // Keep existing embeddings count
          lastActiveAt,
          lastSyncAt: new Date()
        };

        // Save to database if requested
        if (saveToDatabase) {
          await Bot.updateOne(
            { _id: bot._id },
            {
              $set: {
                'analytics.totalMessages': totalMessages,
                'analytics.totalSessions': conversationCount,
                'analytics.totalTokensUsed': includeTokens ? totalTokens : (bot.analytics?.totalTokensUsed || 0),
                'analytics.totalEmbeddings': bot.analytics?.totalEmbeddings || 0,
                'analytics.lastActiveAt': lastActiveAt,
                'analytics.lastSyncAt': new Date(),
                totalMessages: totalMessages, // Update legacy field
                updatedAt: new Date()
              }
            }
          );

          console.log(`Updated analytics for bot ${bot.name}: ${totalMessages} messages, ${conversationCount} sessions, ${totalTokens} tokens`);
        }

        results.push({
          botId: bot._id,
          botName: bot.name,
          analytics: updatedAnalytics,
          synced: saveToDatabase
        });

      } catch (botError) {
        console.error(`Error syncing bot ${bot.name}:`, botError);
        results.push({
          botId: bot._id,
          botName: bot.name,
          error: botError.message,
          synced: false
        });
      }
    }

    console.log('Analytics sync completed successfully');
    return { 
      success: true, 
      botsUpdated: results.filter(r => r.synced).length, 
      results 
    };

  } catch (error) {
    console.error('Error syncing bot analytics:', error);
    throw error;
  }
}

/**
 * Fallback sync function when Conversation/Message models are not available
 */
async function syncBotAnalyticsFallback(botId = null, options = {}) {
  const { saveToDatabase = true } = options;
  
  try {
    await connectDB();
    
    // If botId is provided, sync only that bot, otherwise sync all bots
    const filter = botId ? { _id: botId } : {};
    const bots = await Bot.find(filter);

    console.log(`🔄 Using fallback sync for ${bots.length} bot(s) (Conversation/Message models not available)...`);
    const results = [];

    for (const bot of bots) {
      try {
        // Get fallback analytics
        const fallbackAnalytics = await getFallbackAnalytics(bot);
        
        // Save to database if requested
        if (saveToDatabase) {
          await Bot.updateOne(
            { _id: bot._id },
            {
              $set: {
                'analytics.totalMessages': fallbackAnalytics.totalMessages,
                'analytics.totalSessions': fallbackAnalytics.totalSessions,
                'analytics.totalTokensUsed': fallbackAnalytics.totalTokensUsed,
                'analytics.totalEmbeddings': fallbackAnalytics.totalEmbeddings,
                'analytics.lastActiveAt': fallbackAnalytics.lastActiveAt,
                'analytics.lastSyncAt': new Date(),
                'analytics._fallbackSync': true, // Mark as fallback sync
                totalMessages: fallbackAnalytics.totalMessages, // Update legacy field
                updatedAt: new Date()
              }
            }
          );

          console.log(`✅ Fallback sync completed for bot ${bot.name}`);
        }

        results.push({
          botId: bot._id,
          botName: bot.name,
          analytics: fallbackAnalytics,
          synced: saveToDatabase,
          method: 'fallback'
        });

      } catch (botError) {
        console.error(`❌ Error syncing bot ${bot.name}:`, botError);
        results.push({
          botId: bot._id,
          botName: bot.name,
          error: botError.message,
          synced: false,
          method: 'fallback'
        });
      }
    }

    console.log('Fallback analytics sync completed');
    return { 
      success: true, 
      botsUpdated: results.filter(r => r.synced).length, 
      results,
      method: 'fallback'
    };
    
  } catch (error) {
    console.error('Error in fallback analytics sync:', error);
    throw error;
  }
}

/**
 * Sync analytics for multiple bots by ID
 * @param {Array} botIds - Array of bot IDs to sync
 * @param {Object} options - Sync options
 * @returns {Array} Array of sync results
 */
export async function syncMultipleBotsAnalytics(botIds, options = {}) {
  const results = [];
  
  for (const botId of botIds) {
    try {
      const result = await syncBotAnalytics(botId, options);
      if (result.results && result.results.length > 0) {
        results.push(result.results[0]);
      }
    } catch (error) {
      console.error(`Failed to sync bot ${botId}:`, error.message);
      results.push({
        botId,
        error: error.message,
        synced: false
      });
    }
  }
  
  return results;
}

/**
 * Get real-time bot statistics without saving to database
 * Useful for dashboard pages that need current data
 * @param {string|ObjectId} botId - The bot ID
 * @returns {Object} Real-time statistics
 */
export async function getBotStatistics(botId) {
  try {
    const result = await syncBotAnalytics(botId, { saveToDatabase: false });
    if (result && result.results && result.results.length > 0) {
      return result.results[0].analytics;
    }
    return null;
  } catch (error) {
    console.error('Error getting bot statistics:', error);
    // Fallback: try to get stored analytics directly
    try {
      await connectDB();
      const bot = await Bot.findById(botId).select('analytics updatedAt').lean();
      if (bot) {
        return bot.analytics || {
          totalMessages: 0,
          totalSessions: 0,
          totalTokensUsed: 0,
          totalEmbeddings: 0,
          lastActiveAt: bot.updatedAt,
          _fallbackUsed: true
        };
      }
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
    }
    return null;
  }
}

/**
 * Get real-time statistics for multiple bots
 * @param {Array} botIds - Array of bot IDs
 * @returns {Map} Map of botId to statistics
 */
export async function getMultipleBotsStatistics(botIds) {
  const statsMap = new Map();
  
  for (const botId of botIds) {
    try {
      const stats = await getBotStatistics(botId);
      if (stats) {
        statsMap.set(botId.toString(), stats);
      }
    } catch (error) {
      console.error(`Failed to get stats for bot ${botId}:`, error.message);
    }
  }
  
  return statsMap;
}

/**
 * Utility to ensure analytics sync for API responses
 * This can be used in API routes to ensure data consistency
 * @param {Array} bots - Array of bot documents
 * @param {Object} options - Options for syncing
 * @returns {Array} Bots with synced analytics
 */
export async function ensureAnalyticsSync(bots, options = {}) {
  const { forceSync = false, realTimeStats = true } = options;
  
  if (!realTimeStats) {
    return bots; // Return as-is if real-time stats not requested
  }
  
  try {
    // Check if models are available first
    const models = await getModels();
    
    if (!models) {
      // Use stored analytics when models not available
      console.log('⚠️ Using stored analytics (models not available)');
      return bots.map(bot => ({
        ...bot,
        totalMessages: bot.analytics?.totalMessages || 0,
        analytics: bot.analytics || {
          totalMessages: 0,
          totalSessions: 0,
          totalTokensUsed: 0,
          totalEmbeddings: 0,
          lastActiveAt: bot.updatedAt,
          _fallbackUsed: true
        },
        lastActiveAt: bot.analytics?.lastActiveAt || bot.updatedAt
      }));
    }
    
    // Get real-time statistics for all bots
    const botIds = bots.map(bot => bot._id || bot.id);
    const statsMap = await getMultipleBotsStatistics(botIds);
    
    // Update bot data with real-time stats
    return bots.map(bot => {
      const botId = (bot._id || bot.id).toString();
      const realTimeStats = statsMap.get(botId);
      
      if (realTimeStats) {
        return {
          ...bot,
          totalMessages: realTimeStats.totalMessages,
          analytics: realTimeStats,
          lastActiveAt: realTimeStats.lastActiveAt
        };
      }
      
      // Fallback to stored analytics
      return {
        ...bot,
        totalMessages: bot.analytics?.totalMessages || 0,
        analytics: bot.analytics || {
          totalMessages: 0,
          totalSessions: 0,
          totalTokensUsed: 0,
          totalEmbeddings: 0,
          lastActiveAt: bot.updatedAt,
          _fallbackUsed: true
        },
        lastActiveAt: bot.analytics?.lastActiveAt || bot.updatedAt
      };
    });
    
  } catch (error) {
    console.error('Error ensuring analytics sync:', error);
    // Return original data with stored analytics as fallback
    return bots.map(bot => ({
      ...bot,
      totalMessages: bot.analytics?.totalMessages || 0,
      analytics: bot.analytics || {
        totalMessages: 0,
        totalSessions: 0,
        totalTokensUsed: 0,
        totalEmbeddings: 0,
        lastActiveAt: bot.updatedAt,
        _fallbackUsed: true
      },
      lastActiveAt: bot.analytics?.lastActiveAt || bot.updatedAt
    }));
  }
}