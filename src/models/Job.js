import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema(
	{
		// Job identification
		jobId: {
			type: String,
			required: true,
			unique: true, // BullMQ job ID
		},
		type: {
			type: String,
			enum: ['file-processing', 'embedding-generation', 'cleanup', 'analytics'],
			required: true,
		},
		// Related entities
		userId: {
			type: String,
			required: true,
		},
		botId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Bot',
			sparse: true,
		},
		fileId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'File',
			sparse: true,
		},
		// Job status and progress
		status: {
			type: String,
			enum: ['waiting', 'active', 'completed', 'failed', 'delayed', 'paused'],
			default: 'waiting',
		},
		progress: {
			type: Number,
			min: 0,
			max: 100,
			default: 0,
		},
		// Job data and results
		data: {
			type: mongoose.Schema.Types.Mixed,
			default: {},
		},
		result: {
			type: mongoose.Schema.Types.Mixed,
			default: {},
		},
		error: {
			message: String,
			stack: String,
			code: String,
		},
		// Timing information
		startedAt: Date,
		completedAt: Date,
		failedAt: Date,
		// Retry information
		attempts: {
			type: Number,
			default: 0,
		},
		maxAttempts: {
			type: Number,
			default: 3,
		},
		// Priority and delay
		priority: {
			type: Number,
			default: 0,
		},
		delay: {
			type: Number,
			default: 0,
		},
		// Processing metadata
		processingTime: {
			type: Number, // in milliseconds
			default: 0,
		},
		workerInfo: {
			workerId: String,
			workerVersion: String,
			processedAt: Date,
		},
		// Cleanup
		shouldCleanup: {
			type: Boolean,
			default: true,
		},
		cleanupAfter: {
			type: Date,
			default: function() {
				// Clean up after 7 days
				return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
			},
		},
	},
	{ timestamps: true }
);

// Indexes for better performance
jobSchema.index({ jobId: 1 });
jobSchema.index({ userId: 1, createdAt: -1 });
jobSchema.index({ botId: 1, type: 1 });
jobSchema.index({ status: 1, createdAt: -1 });
jobSchema.index({ type: 1, status: 1 });
jobSchema.index({ cleanupAfter: 1 }); // For cleanup operations

// Compound indexes for common queries
jobSchema.index({ userId: 1, status: 1, type: 1 });
jobSchema.index({ fileId: 1, type: 1, status: 1 });

export default mongoose.models.Job || mongoose.model('Job', jobSchema);