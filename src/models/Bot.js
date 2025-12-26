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
				validator: function (domains) {
					return domains.every((domain) => {
						const trimmed = domain.trim();
						// Allow URLs with protocols or just domain names
						if (
							trimmed.startsWith('http://') ||
							trimmed.startsWith('https://')
						) {
							try {
								new URL(trimmed);
								return true;
							} catch {
								return false;
							}
						}
						// Basic domain validation for domain-only format
						return /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed);
					});
				},
				message: 'Invalid domain format',
			},
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
					validator: function (color) {
						return /^#[0-9A-F]{6}$/i.test(color);
					},
					message: 'Invalid hex color format',
				},
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
				default: true,
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
			storageUsed: {
				type: Number,
				default: 0, // in bytes
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
			maxTotalStorage: {
				type: Number,
				default: 52428800, // 50MB in bytes
			},
		},
		// API Configuration for custom OpenAI keys
		openaiApiConfig: {
			// Encrypted API key storage
			apiKeyEncrypted: {
				type: String,
				default: null,
				select: false, // Don't return in queries by default for security
			},
			// Key status tracking
			keyStatus: {
				type: String,
				enum: ['none', 'valid', 'invalid', 'expired', 'quota_exceeded'],
				default: 'none',
			},
			// Last validation check
			lastValidated: {
				type: Date,
				default: null,
			},
			// Model preferences for this bot
			models: {
				chat: {
					type: String,
					default: 'gpt-4',
					enum: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
				},
				embeddings: {
					type: String,
					default: 'text-embedding-3-small',
					enum: ['text-embedding-3-small', 'text-embedding-3-large'],
				},
			},
		},

		// Fallback configuration
		fallbackToGlobal: {
			type: Boolean,
			default: false,
		},

		// File management
		fileCount: {
			type: Number,
			default: 0,
		},
	},
	{ timestamps: true }
);

export default mongoose.models.Bot || mongoose.model('Bot', botSchema);
