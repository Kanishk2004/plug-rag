import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  // Unique identifier
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    auto: true
  },

  // References
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DashboardConversation',
    required: true,
    index: true
  },

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

  // Message content
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true,
    index: true
  },

  content: {
    type: String,
    required: true,
    maxlength: 10000 // Reasonable limit for message content
  },

  // For user messages - original query
  originalQuery: {
    type: String,
    default: ''
  },

  // For assistant responses - RAG metadata
  sources: [{
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'File'
    },
    chunkId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chunk'
    },
    fileName: String,
    chunkContent: String,
    similarityScore: {
      type: Number,
      min: 0,
      max: 1
    },
    retrievedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Response generation metadata
  metadata: {
    // Token usage
    promptTokens: {
      type: Number,
      default: 0
    },
    completionTokens: {
      type: Number,
      default: 0
    },
    totalTokens: {
      type: Number,
      default: 0
    },
    
    // Model and performance
    model: {
      type: String,
      default: 'gpt-3.5-turbo'
    },
    responseTime: {
      type: Number, // milliseconds
      default: 0
    },
    
    // Quality metrics
    confidence: {
      type: Number,
      min: 0,
      max: 1
    },
    sourcesCount: {
      type: Number,
      default: 0
    },
    
    // Processing steps
    retrievalTime: {
      type: Number, // milliseconds for vector search
      default: 0
    },
    generationTime: {
      type: Number, // milliseconds for LLM response
      default: 0
    }
  },

  // Status and flags
  status: {
    type: String,
    enum: ['sent', 'processing', 'completed', 'failed'],
    default: 'sent',
    index: true
  },

  error: {
    message: String,
    code: String,
    stack: String
  },

  // Feedback (optional)
  feedback: {
    helpful: {
      type: Boolean,
      default: null
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      maxlength: 500
    }
  },

  // Timestamps
  sentAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  processedAt: Date,
  
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
messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ botId: 1, userId: 1, createdAt: -1 });
messageSchema.index({ role: 1, status: 1, createdAt: -1 });

// Virtual for sources count
messageSchema.virtual('sourcesCount').get(function() {
  return this.sources ? this.sources.length : 0;
});

// Methods
messageSchema.methods.markAsProcessing = function() {
  this.status = 'processing';
  this.processedAt = new Date();
  return this.save();
};

messageSchema.methods.markAsCompleted = function(metadata = {}) {
  this.status = 'completed';
  this.processedAt = new Date();
  this.metadata = { ...this.metadata, ...metadata };
  return this.save();
};

messageSchema.methods.markAsFailed = function(error) {
  this.status = 'failed';
  this.processedAt = new Date();
  this.error = {
    message: error.message,
    code: error.code || 'UNKNOWN_ERROR',
    stack: error.stack
  };
  return this.save();
};

messageSchema.methods.addSources = function(sources) {
  this.sources = sources;
  this.metadata.sourcesCount = sources.length;
  return this.save();
};

// Static methods
messageSchema.statics.createUserMessage = function(conversationId, botId, userId, content) {
  return this.create({
    conversationId,
    botId,
    userId,
    role: 'user',
    content,
    originalQuery: content,
    status: 'sent'
  });
};

messageSchema.statics.createAssistantMessage = function(conversationId, botId, userId, content, sources = []) {
  return this.create({
    conversationId,
    botId,
    userId,
    role: 'assistant',
    content,
    sources,
    status: 'completed',
    metadata: {
      sourcesCount: sources.length
    }
  });
};

messageSchema.statics.getConversationMessages = function(conversationId, limit = 50) {
  return this.find({ conversationId })
    .sort({ createdAt: 1 })
    .limit(limit)
    .populate('sources.documentId', 'originalName fileType')
    .populate('sources.chunkId', 'chunkIndex tokens');
};

// Logging middleware
messageSchema.pre('save', function(next) {
  console.log(`[MESSAGE] Saving ${this.role} message ${this._id} for conversation ${this.conversationId}`);
  this.updatedAt = new Date();
  next();
});

messageSchema.post('save', function(doc) {
  console.log(`[MESSAGE] ✅ ${doc.role} message ${doc._id} saved with status: ${doc.status}`);
});

messageSchema.post('remove', function(doc) {
  console.log(`[MESSAGE] 🗑️ Message ${doc._id} removed`);
});

const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);

export default Message;