import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema(
	{
		// Core file information
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

		// Processing status
		s3Key: {
			type: String,
			required: true,
		},
		s3Bucket: {
			type: String,
			required: true,
		},
		s3Region: {
			type: String,
			required: true,
		},
		storageUrl: {
			type: String,
			required: true,
		},
		status: {
			type: String,
			enum: ['uploaded', 'processing', 'completed', 'failed', 'deleted'],
			default: 'uploaded',
		},
		processingError: {
			type: String,
			default: '',
		},

		// Vector embeddings info
		embeddingStatus: {
			type: String,
			enum: [
				'pending',
				'processing',
				'completed',
				'failed',
				'deleted',
				'queued',
				'retrying',
			],
			default: 'pending',
		},
		totalChunks: {
			type: Number,
			default: 0,
		},
		embeddingTokens: {
			type: Number,
			default: 0,
		},
		estimatedCost: {
			type: Number,
			default: 0,
		},
		embeddedAt: {
			type: Date,
		},
		processedAt: {
			type: Date,
		},
		processingJobId: {
			type: String,
		},
		processingStartedAt: {
			type: Date,
		},
		processingCheckpoints: {
			type: [String],
			default: [],
		},
	},
	{ timestamps: true }
);

// Indexes for better performance
fileSchema.index({ botId: 1, status: 1 });
fileSchema.index({ ownerId: 1, createdAt: -1 });
fileSchema.index({ status: 1, embeddingStatus: 1 });

export default mongoose.models.File || mongoose.model('File', fileSchema);
