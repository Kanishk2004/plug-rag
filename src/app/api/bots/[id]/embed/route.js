import { auth } from '@clerk/nextjs/server';
import connect from '@/lib/integrations/mongo';
import Bot from '@/models/Bot';
import { getCurrentDBUser, syncUserWithDB } from '@/lib/integrations/clerk';
import {
	apiSuccess,
	authError,
	notFoundError,
	serverError,
	validationError,
} from '@/lib/utils/apiResponse';
import mongoose from 'mongoose';
import { NEXT_PUBLIC_APP_URL } from '@/lib/utils/envConfig';

/**
 * GET /api/bots/[id]/embed - Get embed code and configuration
 *
 * Generates ready-to-use embed code with bot's customization settings.
 * Returns both the complete HTML snippet and bot metadata for integration.
 *
 * @param {Request} request - The request object
 * @param {Object} params - Route parameters containing bot ID
 * @returns {Response} Embed code and bot configuration
 */
export async function GET(request, { params }) {
	try {
		// Step 1: Authenticate user
		const { userId } = await auth();
		if (!userId) return authError();

		// Step 2: Await params and validate bot ID
		const { id: botId } = await params;
		if (!botId) return validationError('Bot ID is required');

		// Validate MongoDB ObjectId format
		if (!mongoose.Types.ObjectId.isValid(botId)) {
			return validationError('Invalid bot ID format');
		}

		// Step 3: Connect to database
		await connect();

		// Step 4: Ensure user exists in database
		let user = await getCurrentDBUser(userId);
		if (!user) {
			user = await syncUserWithDB(userId);
			if (!user) return authError('Failed to create user in DB');
		}

		// Step 5: Find bot and verify ownership
		const bot = await Bot.findOne({
			_id: botId,
			ownerId: userId,
		})
			.select('name customization status')
			.lean();

		if (!bot) {
			return notFoundError('Bot not found or access denied');
		}

		// Step 6: Get app URL from environment or use default
		const appUrl = NEXT_PUBLIC_APP_URL;

		// Step 7: Generate embed code with bot's actual settings
		const embedCode = generateEmbedCode(botId, bot.customization, appUrl);

		// Step 8: Prepare bot metadata for client use
		const botMetadata = {
			botId: bot._id.toString(),
			name: bot.name,
			customization: {
				bubbleColor: bot.customization.bubbleColor,
				position: bot.customization.position,
				greeting: bot.customization.greeting,
				placeholder: bot.customization.placeholder,
				title: bot.customization.title,
			},
			isActive: bot.status === 'active',
		};

		return apiSuccess({
			embedCode,
			botMetadata,
			instructions:
				'Copy this code and paste it before the closing </body> tag of your website',
		});
	} catch (error) {
		console.error('Error generating embed code:', error);
		return serverError('Failed to generate embed code');
	}
}

/**
 * Generate HTML embed code with bot configuration
 *
 * @param {string} botId - Bot ID
 * @param {Object} customization - Bot customization settings
 * @param {string} appUrl - Application base URL
 * @returns {string} Complete HTML embed code
 */
function generateEmbedCode(botId, customization, appUrl) {
	const config = {
		botId,
		color: customization.bubbleColor,
		position: customization.position,
		greeting: customization.greeting,
		placeholder: customization.placeholder,
		title: customization.title,
		apiBase: appUrl,
	};

	return `<!-- PlugRAG Chatbot Widget -->
<script>
  window.PlugRAGConfig = ${JSON.stringify(config, null, 2)};
</script>
<script src="${appUrl}/embed.js" async></script>`;
}
