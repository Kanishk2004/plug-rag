/**
 * Analytics Service
 * 
 * Handles analytics data collection, processing, and reporting
 * for bot interactions, file processing, and user activities.
 */

import { logInfo, logError } from '../utils/logger.js';
import { connectToDatabase } from '../integrations/mongo.js';

/**
 * Analytics event types
 */
export const ANALYTICS_EVENTS = {
  BOT_CREATED: 'bot_created',
  BOT_UPDATED: 'bot_updated', 
  BOT_DELETED: 'bot_deleted',
  FILE_UPLOADED: 'file_uploaded',
  FILE_PROCESSED: 'file_processed',
  FILE_DELETED: 'file_deleted',
  CHAT_MESSAGE: 'chat_message',
  API_KEY_ADDED: 'api_key_added',
  USER_LOGIN: 'user_login',
  EMBEDDING_GENERATED: 'embedding_generated',
  VECTOR_SEARCH: 'vector_search'
};

/**
 * Record an analytics event
 * @param {string} eventType - Type of event from ANALYTICS_EVENTS
 * @param {string} userId - User ID who performed the action
 * @param {Object} metadata - Additional event data
 * @returns {Promise<void>}
 */
export async function recordEvent(eventType, userId, metadata = {}) {
  try {
    const { db } = await connectToDatabase();
    
    const event = {
      eventType,
      userId,
      metadata,
      timestamp: new Date(),
      sessionId: metadata.sessionId || null,
      userAgent: metadata.userAgent || null,
      ipAddress: metadata.ipAddress || null
    };

    await db.collection('analytics_events').insertOne(event);
    
    logInfo('Analytics event recorded', { 
      eventType, 
      userId,
      hasMetadata: Object.keys(metadata).length > 0
    });
  } catch (error) {
    logError('Failed to record analytics event', { 
      eventType, 
      userId, 
      error: error.message 
    });
  }
}

/**
 * Get analytics summary for a specific user
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @param {Date} options.startDate - Start date for analytics
 * @param {Date} options.endDate - End date for analytics
 * @returns {Promise<Object>} Analytics summary
 */
export async function getUserAnalytics(userId, options = {}) {
  try {
    const { db } = await connectToDatabase();
    
    const { startDate, endDate } = options;
    const query = { userId };
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    // Get event counts by type
    const eventCounts = await db.collection('analytics_events').aggregate([
      { $match: query },
      { $group: { _id: '$eventType', count: { $sum: 1 } } }
    ]).toArray();

    // Get recent activity
    const recentActivity = await db.collection('analytics_events')
      .find(query)
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();

    // Calculate totals
    const totalEvents = eventCounts.reduce((sum, event) => sum + event.count, 0);

    return {
      userId,
      period: { startDate, endDate },
      totalEvents,
      eventCounts: eventCounts.reduce((acc, event) => {
        acc[event._id] = event.count;
        return acc;
      }, {}),
      recentActivity
    };
  } catch (error) {
    logError('Failed to get user analytics', { userId, error: error.message });
    throw error;
  }
}

/**
 * Get bot-specific analytics
 * @param {string} botId - Bot ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Bot analytics
 */
export async function getBotAnalytics(botId, options = {}) {
  try {
    const { db } = await connectToDatabase();
    
    const { startDate, endDate } = options;
    const query = { 'metadata.botId': botId };
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    // Get chat message stats
    const chatStats = await db.collection('analytics_events').aggregate([
      { $match: { ...query, eventType: ANALYTICS_EVENTS.CHAT_MESSAGE } },
      { 
        $group: { 
          _id: null, 
          messageCount: { $sum: 1 },
          avgResponseTime: { $avg: '$metadata.responseTime' },
          users: { $addToSet: '$userId' }
        } 
      }
    ]).toArray();

    // Get file processing stats
    const fileStats = await db.collection('analytics_events').aggregate([
      { $match: { ...query, eventType: { $in: [ANALYTICS_EVENTS.FILE_UPLOADED, ANALYTICS_EVENTS.FILE_PROCESSED] } } },
      { $group: { _id: '$eventType', count: { $sum: 1 } } }
    ]).toArray();

    return {
      botId,
      period: { startDate, endDate },
      chatStats: chatStats[0] || { messageCount: 0, avgResponseTime: 0, users: [] },
      fileStats: fileStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      uniqueUsers: chatStats[0]?.users?.length || 0
    };
  } catch (error) {
    logError('Failed to get bot analytics', { botId, error: error.message });
    throw error;
  }
}

/**
 * Get system-wide analytics dashboard data
 * @param {Object} options - Query options
 * @returns {Promise<Object>} System analytics
 */
export async function getSystemAnalytics(options = {}) {
  try {
    const { db } = await connectToDatabase();
    
    const { startDate, endDate } = options;
    const query = {};
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    // Get overall event counts
    const eventCounts = await db.collection('analytics_events').aggregate([
      { $match: query },
      { $group: { _id: '$eventType', count: { $sum: 1 } } }
    ]).toArray();

    // Get daily activity
    const dailyActivity = await db.collection('analytics_events').aggregate([
      { $match: query },
      { 
        $group: { 
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          events: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' }
        } 
      },
      { $sort: { _id: 1 } }
    ]).toArray();

    // Get top active users
    const topUsers = await db.collection('analytics_events').aggregate([
      { $match: query },
      { $group: { _id: '$userId', eventCount: { $sum: 1 } } },
      { $sort: { eventCount: -1 } },
      { $limit: 10 }
    ]).toArray();

    return {
      period: { startDate, endDate },
      eventCounts: eventCounts.reduce((acc, event) => {
        acc[event._id] = event.count;
        return acc;
      }, {}),
      dailyActivity: dailyActivity.map(day => ({
        date: day._id,
        events: day.events,
        uniqueUsers: day.uniqueUsers.length
      })),
      topUsers
    };
  } catch (error) {
    logError('Failed to get system analytics', { error: error.message });
    throw error;
  }
}

/**
 * Record a chat message interaction
 * @param {string} botId - Bot ID
 * @param {string} userId - User ID
 * @param {Object} messageData - Message details
 * @returns {Promise<void>}
 */
export async function recordChatMessage(botId, userId, messageData = {}) {
  await recordEvent(ANALYTICS_EVENTS.CHAT_MESSAGE, userId, {
    botId,
    messageLength: messageData.message?.length || 0,
    responseTime: messageData.responseTime || null,
    sessionId: messageData.sessionId,
    userAgent: messageData.userAgent,
    hasContext: messageData.hasContext || false
  });
}

/**
 * Record file processing analytics
 * @param {string} fileId - File ID
 * @param {string} userId - User ID
 * @param {string} botId - Bot ID
 * @param {Object} processingData - Processing details
 * @returns {Promise<void>}
 */
export async function recordFileProcessing(fileId, userId, botId, processingData = {}) {
  await recordEvent(ANALYTICS_EVENTS.FILE_PROCESSED, userId, {
    fileId,
    botId,
    fileName: processingData.fileName,
    fileSize: processingData.fileSize,
    processingTime: processingData.processingTime,
    chunkCount: processingData.chunkCount,
    embeddingCount: processingData.embeddingCount
  });
}

/**
 * Record bot creation analytics
 * @param {string} botId - Bot ID
 * @param {string} userId - User ID
 * @param {Object} botData - Bot details
 * @returns {Promise<void>}
 */
export async function recordBotCreation(botId, userId, botData = {}) {
  await recordEvent(ANALYTICS_EVENTS.BOT_CREATED, userId, {
    botId,
    botName: botData.name,
    hasCustomApiKey: !!botData.openaiApiKey,
    embeddingModel: botData.embeddingModel || 'default'
  });
}

/**
 * Clean up old analytics events (data retention)
 * @param {number} retentionDays - Number of days to retain data
 * @returns {Promise<number>} Number of deleted events
 */
export async function cleanupOldEvents(retentionDays = 90) {
  try {
    const { db } = await connectToDatabase();
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    const result = await db.collection('analytics_events').deleteMany({
      timestamp: { $lt: cutoffDate }
    });

    logInfo('Analytics cleanup completed', { 
      deletedEvents: result.deletedCount,
      retentionDays
    });

    return result.deletedCount;
  } catch (error) {
    logError('Failed to cleanup analytics events', { 
      retentionDays, 
      error: error.message 
    });
    throw error;
  }
}