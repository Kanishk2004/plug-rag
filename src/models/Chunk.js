import mongoose from 'mongoose';

const chunkSchema = new mongoose.Schema(
	{
		fileId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'File',
			required: true,
		},
		botId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Bot',
			required: true,
		},
		ownerId: {
			type: String,
			required: true,
		},
		// Chunk content
		content: {
			type: String,
			required: true,
		},
		chunkIndex: {
			type: Number,
			required: true,
		},
		tokens: {
			type: Number,
			required: true,
		},
		// Context information
		startOffset: {
			type: Number,
			default: 0,
		},
		endOffset: {
			type: Number,
			default: 0,
		},
		// Vector embedding info
		vectorId: {
			type: String,
			sparse: true, // Qdrant vector ID
		},
		embeddingStatus: {
			type: String,
			enum: ['pending', 'processing', 'completed', 'failed', 'deleted'],
			default: 'pending',
		},
		embeddedAt: {
			type: Date,
		},
		// Chunk type for better categorization
		type: {
			type: String,
			enum: ['paragraph_boundary', 'sentence_boundary', 'document_structure', 'manual'],
			default: 'paragraph_boundary',
		},
		// Metadata for better retrieval
		metadata: {
			pageNumber: Number,
			section: String,
			title: String,
			headings: [String],
			tags: [String],
		},
		// Search and retrieval optimization
		searchableText: {
			type: String,
			default: function() {
				return this.content.toLowerCase();
			},
		},
	},
	{ timestamps: true }
);

// Indexes for better performance
chunkSchema.index({ fileId: 1, chunkIndex: 1 });
chunkSchema.index({ botId: 1, embeddingStatus: 1 });
chunkSchema.index({ ownerId: 1 });
chunkSchema.index({ searchableText: 'text' }); // Text search index

export default mongoose.models.Chunk || mongoose.model('Chunk', chunkSchema);