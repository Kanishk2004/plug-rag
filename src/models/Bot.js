import mongoose from 'mongoose';

const botSchema = new mongoose.Schema(
	{
		ownerId: {
			type: String,
			required: true,
		},
		name: {
			type: String,
			required: true,
			trim: true,
		},
		description: {
			type: String,
			default: '',
			maxlength: 500,
		},
		domainWhitelist: {
			type: [String],
			default: [],
			validate: {
				validator: function(domains) {
					return domains.every(domain => /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain));
				},
				message: 'Invalid domain format'
			}
		},
		botKey: {
			type: String,
			required: true,
			unique: true,
		},
		status: {
			type: String,
			enum: ['active', 'inactive', 'suspended'],
			default: 'active',
		},
		// Customization settings
		customization: {
			bubbleColor: {
				type: String,
				default: '#3B82F6',
				validate: {
					validator: function(color) {
						return /^#[0-9A-F]{6}$/i.test(color);
					},
					message: 'Invalid hex color format'
				}
			},
			position: {
				type: String,
				enum: ['bottom-right', 'bottom-left', 'top-right', 'top-left'],
				default: 'bottom-right',
			},
			greeting: {
				type: String,
				default: 'Hello! How can I help you today?',
				maxlength: 200,
			},
			placeholder: {
				type: String,
				default: 'Type your message...',
				maxlength: 100,
			},
			title: {
				type: String,
				default: 'Chat Assistant',
				maxlength: 50,
			},
		},
		// Vector storage configuration
		vectorStorage: {
			enabled: {
				type: Boolean,
				default: false,
			},
			provider: {
				type: String,
				enum: ['qdrant'],
				default: 'qdrant',
			},
			collectionName: {
				type: String,
				default: '',
			},
			dimensions: {
				type: Number,
				default: 1536, // OpenAI text-embedding-3-small
			},
			model: {
				type: String,
				default: 'text-embedding-3-small',
			},
			createdAt: {
				type: Date,
			},
			deletedAt: {
				type: Date,
			},
		},
		// Analytics and limits
		analytics: {
			totalMessages: {
				type: Number,
				default: 0,
			},
			totalSessions: {
				type: Number,
				default: 0,
			},
			totalEmbeddings: {
				type: Number,
				default: 0,
			},
			totalTokensUsed: {
				type: Number,
				default: 0,
			},
			lastActiveAt: {
				type: Date,
				default: Date.now,
			},
		},
		limits: {
			maxFilesPerBot: {
				type: Number,
				default: 10,
			},
			maxFileSize: {
				type: Number,
				default: 10485760, // 10MB in bytes
			},
			messagesPerMonth: {
				type: Number,
				default: 1000,
			},
		},
		// File management
		fileCount: {
			type: Number,
			default: 0,
		},
		totalTokens: {
			type: Number,
			default: 0,
		},
		isEmbeddingComplete: {
			type: Boolean,
			default: true,
		},
	},
	{ timestamps: true }
);

export default mongoose.models.Bot || mongoose.model('Bot', botSchema);
