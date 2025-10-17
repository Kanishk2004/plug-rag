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
		},
		domainWhitelist: {
			type: [String],
			default: [],
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
	},
	{ timestamps: true }
);

export default mongoose.models.Bot || mongoose.model('Bot', botSchema);
