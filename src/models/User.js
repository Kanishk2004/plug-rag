import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
	{
		clerkId: {
			type: String,
			required: true,
			unique: true,
		},
		email: {
			type: String,
			required: true,
			unique: true,
		},
		firstName: {
			type: String,
			trim: true,
		},
		lastName: {
			type: String,
			trim: true,
		},
		usage: {
			botsCreated: {
				type: Number,
				default: 0,
			},
			storageUsed: {
				type: Number,
				default: 0, // in bytes
			}
		},
		limits: {
			maxBots: {
				type: Number,
				default: 1, // free plan limit
			},
			maxMessages: {
				type: Number,
				default: 100, // free plan limit
			},
			maxStorage: {
				type: Number,
				default: 50 * 1024 * 1024, // 50MB for free plan
			},
		},
		preferences: {
			emailNotifications: {
				type: Boolean,
				default: true,
			},
			marketingEmails: {
				type: Boolean,
				default: false,
			},
		},
	},
	{ timestamps: true }
);

export default mongoose.models.User || mongoose.model('User', userSchema);
