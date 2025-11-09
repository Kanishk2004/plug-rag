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

// TODO: Add basic static methods for conversation management as needed

const DashboardConversation = mongoose.models.DashboardConversation || mongoose.model('DashboardConversation', dashboardConversationSchema);

export default DashboardConversation;