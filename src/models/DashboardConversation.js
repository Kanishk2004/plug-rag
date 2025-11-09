import mongoose from 'mongoose';

const dashboardConversationSchema = new mongoose.Schema({
  // Unique identifier
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    auto: true
  },

  // References
  botId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bot',
    required: true,
    index: true
  },

  userId: {
    type: String, // Clerk user ID
    required: true,
    index: true
  },

  // Conversation metadata
  title: {
    type: String,
    default: function() {
      return `Test Chat - ${new Date().toLocaleDateString()}`;
    }
  },

  // Status tracking
  status: {
    type: String,
    enum: ['active', 'archived', 'deleted'],
    default: 'active',
    index: true
  },

  // Analytics and metrics
  analytics: {
    messageCount: {
      type: Number,
      default: 0
    },
    
    userMessages: {
      type: Number,
      default: 0
    },
    
    assistantMessages: {
      type: Number,
      default: 0
    },
    
    totalTokensUsed: {
      type: Number,
      default: 0
    },
    
    avgResponseTime: {
      type: Number, // milliseconds
      default: 0
    },
    
    sourcesRetrieved: {
      type: Number,
      default: 0
    },
    
    avgConfidenceScore: {
      type: Number,
      min: 0,
      max: 1,
      default: 0
    }
  },

  // Session information
  sessionInfo: {
    userAgent: String,
    ipAddress: String,
    startedAt: {
      type: Date,
      default: Date.now
    },
    lastActiveAt: {
      type: Date,
      default: Date.now
    },
    duration: {
      type: Number, // seconds
      default: 0
    }
  },

  // Settings for this conversation
  settings: {
    model: {
      type: String,
      default: 'gpt-3.5-turbo'
    },
    maxTokens: {
      type: Number,
      default: 500
    },
    temperature: {
      type: Number,
      min: 0,
      max: 2,
      default: 0.7
    },
    topK: {
      type: Number,
      default: 5 // Number of sources to retrieve
    }
  },

  // Timestamps
  lastMessageAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
dashboardConversationSchema.index({ botId: 1, userId: 1, createdAt: -1 });
dashboardConversationSchema.index({ botId: 1, status: 1, lastMessageAt: -1 });
dashboardConversationSchema.index({ userId: 1, status: 1, lastMessageAt: -1 });

// Virtual for message population
dashboardConversationSchema.virtual('messages', {
  ref: 'Message',
  localField: '_id',
  foreignField: 'conversationId'
});

// Virtual for recent messages
dashboardConversationSchema.virtual('recentMessages', {
  ref: 'Message',
  localField: '_id',
  foreignField: 'conversationId',
  options: { sort: { createdAt: -1 }, limit: 10 }
});

// Methods
dashboardConversationSchema.methods.addMessage = function(role, tokenCount = 0) {
  this.analytics.messageCount += 1;
  this.analytics.totalTokensUsed += tokenCount;
  
  if (role === 'user') {
    this.analytics.userMessages += 1;
  } else if (role === 'assistant') {
    this.analytics.assistantMessages += 1;
  }
  
  this.lastMessageAt = new Date();
  this.sessionInfo.lastActiveAt = new Date();
  
  return this.save();
};

dashboardConversationSchema.methods.updateAnalytics = function(metrics) {
  if (metrics.responseTime) {
    const totalResponses = this.analytics.assistantMessages;
    const currentAvg = this.analytics.avgResponseTime || 0;
    this.analytics.avgResponseTime = ((currentAvg * (totalResponses - 1)) + metrics.responseTime) / totalResponses;
  }
  
  if (metrics.sourcesCount) {
    this.analytics.sourcesRetrieved += metrics.sourcesCount;
  }
  
  if (metrics.confidence) {
    const totalResponses = this.analytics.assistantMessages;
    const currentAvg = this.analytics.avgConfidenceScore || 0;
    this.analytics.avgConfidenceScore = ((currentAvg * (totalResponses - 1)) + metrics.confidence) / totalResponses;
  }
  
  return this.save();
};

dashboardConversationSchema.methods.updateDuration = function() {
  const now = new Date();
  const started = this.sessionInfo.startedAt;
  this.sessionInfo.duration = Math.floor((now - started) / 1000);
  this.sessionInfo.lastActiveAt = now;
  
  return this.save();
};

dashboardConversationSchema.methods.archive = function() {
  this.status = 'archived';
  return this.save();
};

// Static methods
dashboardConversationSchema.statics.findActiveByBotAndUser = function(botId, userId) {
  return this.findOne({
    botId,
    userId,
    status: 'active'
  }).sort({ lastMessageAt: -1 });
};

dashboardConversationSchema.statics.getOrCreateActiveConversation = async function(botId, userId, sessionInfo = {}) {
  let conversation = await this.findActiveByBotAndUser(botId, userId);
  
  if (!conversation) {
    conversation = await this.create({
      botId,
      userId,
      status: 'active',
      sessionInfo: {
        ...sessionInfo,
        startedAt: new Date(),
        lastActiveAt: new Date()
      }
    });
    console.log(`[DASHBOARD-CONVERSATION] ✅ Created new conversation ${conversation._id} for bot ${botId}`);
  } else {
    conversation.sessionInfo.lastActiveAt = new Date();
    await conversation.save();
    console.log(`[DASHBOARD-CONVERSATION] ✅ Retrieved existing conversation ${conversation._id} for bot ${botId}`);
  }
  
  return conversation;
};

dashboardConversationSchema.statics.getUserConversations = function(userId, limit = 20) {
  return this.find({ userId, status: { $ne: 'deleted' } })
    .populate('botId', 'name description')
    .sort({ lastMessageAt: -1 })
    .limit(limit);
};

dashboardConversationSchema.statics.getBotConversations = function(botId, limit = 50) {
  return this.find({ botId, status: { $ne: 'deleted' } })
    .sort({ lastMessageAt: -1 })
    .limit(limit);
};

// Logging middleware
dashboardConversationSchema.pre('save', function(next) {
  console.log(`[DASHBOARD-CONVERSATION] Saving conversation ${this._id} for bot ${this.botId}`);
  this.updatedAt = new Date();
  next();
});

dashboardConversationSchema.post('save', function(doc) {
  console.log(`[DASHBOARD-CONVERSATION] ✅ Conversation ${doc._id} saved successfully (${doc.analytics.messageCount} messages)`);
});

dashboardConversationSchema.post('remove', function(doc) {
  console.log(`[DASHBOARD-CONVERSATION] 🗑️ Conversation ${doc._id} removed`);
});

const DashboardConversation = mongoose.models.DashboardConversation || mongoose.model('DashboardConversation', dashboardConversationSchema);

export default DashboardConversation;