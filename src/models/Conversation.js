import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
	role: {
		type: String,
		enum: ['user', 'assistant'],
		required: true,
	},
	content: {
		type: String,
		required: true,
	},
	timestamp: {
		type: Date,
		default: Date.now,
	},
	// For assistant responses
	retrievedChunks: [{
		chunkId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Chunk',
		},
		score: Number,
		content: String,
	}],
	tokens: {
		type: Number,
		default: 0,
	},
	// Response metadata
	responseTime: {
		type: Number, // in milliseconds
		default: 0,
	},
	model: {
		type: String,
		default: 'gpt-3.5-turbo',
	},
});

const conversationSchema = new mongoose.Schema(
	{
		botId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Bot',
			required: true,
		},
		sessionId: {
			type: String,
			required: true,
		},
		// User information (anonymous)
		userFingerprint: {
			type: String,
			default: '',
		},
		userAgent: {
			type: String,
			default: '',
		},
		ipAddress: {
			type: String,
			default: '',
		},
		// Domain and referrer info
		domain: {
			type: String,
			required: true,
		},
		referrer: {
			type: String,
			default: '',
		},
		// Conversation data
		messages: [messageSchema],
		status: {
			type: String,
			enum: ['active', 'ended', 'abandoned'],
			default: 'active',
		},
		// Analytics
		totalMessages: {
			type: Number,
			default: 0,
		},
		totalTokens: {
			type: Number,
			default: 0,
		},
		duration: {
			type: Number, // in seconds
			default: 0,
		},
		// Feedback
		rating: {
			type: Number,
			min: 1,
			max: 5,
			sparse: true,
		},
		feedback: {
			type: String,
			maxlength: 1000,
		},
		// Session metadata
		startedAt: {
			type: Date,
			default: Date.now,
		},
		endedAt: Date,
		lastMessageAt: {
			type: Date,
			default: Date.now,
		},
	},
	{ timestamps: true }
);

// Indexes for better performance
conversationSchema.index({ botId: 1, createdAt: -1 });
conversationSchema.index({ sessionId: 1 });
conversationSchema.index({ domain: 1, createdAt: -1 });
conversationSchema.index({ status: 1, lastMessageAt: -1 });

export default mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);