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
	// New RAG-specific fields
	sources: [
		{
			fileName: String,
			pageNumbers: [Number], // New field for multiple page numbers
			chunkIndices: [Number], // New field for multiple chunk indices
			maxScore: Number, // Highest relevance score across chunks
			avgScore: Number, // Average relevance score across chunks
			chunkCount: { type: Number, default: 1 }, // Number of chunks used from this file
		},
	],
	hasRelevantContext: {
		type: Boolean,
		default: false,
	},
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
		default: 'gpt-4',
	},
	// Intent classification metadata
	responseType: {
		type: String,
		enum: ['faq', 'rag', 'simple_llm', 'small_talk'],
		default: 'rag',
	},
	intentType: {
		type: String,
		enum: ['NEEDS_RAG', 'GENERAL_CHAT', 'SMALL_TALK', null],
		default: null,
	},
	intentConfidence: {
		type: Number,
		default: null,
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
		// Domain info
		domain: {
			type: String,
			default: 'unknown',
		},
		referrer: {
			type: String,
			default: '',
		},
		// Conversation data
		messages: [messageSchema],
		status: {
			type: String,
			enum: ['active', 'ended'],
			default: 'active',
		},
		// Analytics (calculated fields)
		totalMessages: {
			type: Number,
			default: 0,
		},
		totalTokens: {
			type: Number,
			default: 0,
		},
		// Session metadata
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

export default mongoose.models.Conversation ||
	mongoose.model('Conversation', conversationSchema);
