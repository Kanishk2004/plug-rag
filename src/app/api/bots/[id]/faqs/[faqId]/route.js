import { auth } from '@clerk/nextjs/server';
import Bot from '@/models/Bot.js';
import connect from '@/lib/integrations/mongo.js';
import {
	apiSuccess,
	authError,
	forbiddenError,
	notFoundError,
	serverError,
	validationError,
} from '@/lib/utils/apiResponse.js';

/**
 * Auto-generate keywords from question text
 */
function generateKeywords(question) {
	const stopWords = new Set([
		'a',
		'an',
		'the',
		'is',
		'are',
		'was',
		'were',
		'be',
		'been',
		'being',
		'have',
		'has',
		'had',
		'do',
		'does',
		'did',
		'will',
		'would',
		'should',
		'could',
		'can',
		'may',
		'might',
		'must',
		'what',
		'when',
		'where',
		'who',
		'why',
		'how',
		'i',
		'you',
		'he',
		'she',
		'it',
		'we',
		'they',
		'my',
		'your',
		'his',
		'her',
		'its',
		'our',
		'their',
		'this',
		'that',
		'these',
		'those',
	]);

	const words = question
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, ' ')
		.split(/\s+/)
		.filter((word) => word.length > 2 && !stopWords.has(word));

	return [...new Set(words)];
}

/**
 * PUT /api/bots/:id/faqs/:faqId
 * Update a specific FAQ (auth required, owner only)
 */
export async function PUT(request, { params }) {
	try {
		await connect();
		const { userId } = await auth();

		if (!userId) {
			return authError('Unauthorized');
		}

		const { id, faqId } = await params;
		const body = await request.json();
		const { question, answer, keywords, enabled } = body;

		// Validation
		if (question && (question.length < 3 || question.length > 500)) {
			return validationError('Question must be between 3 and 500 characters');
		}

		if (answer && (answer.length < 3 || answer.length > 2000)) {
			return validationError('Answer must be between 3 and 2000 characters');
		}

		// Find bot and verify ownership
		const bot = await Bot.findById(id);
		if (!bot) {
			return notFoundError('Bot not found');
		}

		if (bot.ownerId !== userId) {
			return forbiddenError('You do not own this bot');
		}

		// Find FAQ by ID
		const faq = bot.faqs.id(faqId);
		if (!faq) {
			return notFoundError('FAQ not found');
		}

		// Check if auto-generate keywords
		const { searchParams } = new URL(request.url);
		const genKeywords = searchParams.get('genKeywords') === 'true';

		// Update FAQ fields
		if (question !== undefined) {
			faq.question = question.trim();

			// Auto-generate keywords if flag is set or question changed
			if (genKeywords) {
				faq.keywords = generateKeywords(question);
			}
		}

		if (answer !== undefined) {
			faq.answer = answer.trim();
		}

		if (keywords !== undefined && !genKeywords) {
			faq.keywords = keywords;
		}

		if (enabled !== undefined) {
			faq.enabled = enabled;
		}

		await bot.save();

		return apiSuccess({ faq }, 'FAQ updated successfully');
	} catch (error) {
		console.error('Error updating FAQ:', error);
		return serverError('Failed to update FAQ');
	}
}

/**
 * DELETE /api/bots/:id/faqs/:faqId
 * Delete a specific FAQ (auth required, owner only)
 */
export async function DELETE(request, { params }) {
	try {
		await connect();
		const { userId } = await auth();

		if (!userId) {
			return authError('Unauthorized');
		}

		const { id, faqId } = await params;

		// Find bot and verify ownership
		const bot = await Bot.findById(id);
		if (!bot) {
			return notFoundError('Bot not found');
		}

		if (bot.ownerId !== userId) {
			return forbiddenError('You do not own this bot');
		}

		// Find and remove FAQ
		const faq = bot.faqs.id(faqId);
		if (!faq) {
			return notFoundError('FAQ not found');
		}

		// Remove the FAQ using pull
		bot.faqs.pull(faqId);
		await bot.save();

		return apiSuccess(null, 'FAQ deleted successfully');
	} catch (error) {
		console.error('Error deleting FAQ:', error);
		return serverError('Failed to delete FAQ');
	}
}
