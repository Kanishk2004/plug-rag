import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema(
	{
		botId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Bot',
			required: true,
		},
		ownerId: {
			type: String,
			required: true,
		},
		filename: {
			type: String,
			required: true,
			trim: true,
		},
		originalName: {
			type: String,
			required: true,
		},
		mimeType: {
			type: String,
			required: true,
		},
		fileType: {
			type: String,
			enum: ['pdf', 'docx', 'txt', 'csv', 'html', 'md'],
			required: true,
		},
		size: {
			type: Number,
			required: true, // in bytes
		},
		// Storage information
		s3Key: {
			type: String,
			sparse: true, // temp storage, deleted after processing
		},
		s3Bucket: {
			type: String,
			sparse: true,
		},
		// Processing status
		status: {
			type: String,
			enum: ['uploaded', 'processing', 'completed', 'failed', 'deleted'],
			default: 'uploaded',
		},
		processingError: {
			type: String,
			default: '',
		},
		// Content analysis
		extractedText: {
			type: String,
			default: '',
		},
		totalChunks: {
			type: Number,
			default: 0,
		},
		totalTokens: {
			type: Number,
			default: 0,
		},
		// Vector embeddings info
		embeddingStatus: {
			type: String,
			enum: ['pending', 'processing', 'completed', 'failed'],
			default: 'pending',
		},
		vectorCount: {
			type: Number,
			default: 0,
		},
		qdrantCollection: {
			type: String,
			default: 'documents',
		},
		// Metadata
		metadata: {
			title: String,
			author: String,
			subject: String,
			keywords: [String],
			language: {
				type: String,
				default: 'en',
			},
			pageCount: Number,
		},
		// Job tracking
		jobId: {
			type: String,
			sparse: true, // BullMQ job ID
		},
		processedAt: Date,
	},
	{ timestamps: true }
);

// Indexes for better performance
fileSchema.index({ botId: 1, status: 1 });
fileSchema.index({ ownerId: 1, createdAt: -1 });
fileSchema.index({ status: 1, embeddingStatus: 1 });

export default mongoose.models.File || mongoose.model('File', fileSchema);