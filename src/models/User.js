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
		plan: {
			type: String,
			enum: ['free', 'pro', 'enterprise'],
			default: 'free',
		},
	},
	{ timestamps: true }
);

export default mongoose.models.User || mongoose.model('User', userSchema);
