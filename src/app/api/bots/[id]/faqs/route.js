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
	// Remove common stop words
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

	// Extract words, convert to lowercase, filter stop words
	const words = question
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, ' ')
		.split(/\s+/)
		.filter((word) => word.length > 2 && !stopWords.has(word));

	// Remove duplicates and return
	return [...new Set(words)];
}

/**
 * GET /api/bots/:id/faqs
 * Get all FAQs for a bot (public access)
 */
export async function GET(request, { params }) {
	try {
		await connect();
		const { id } = await params;

		const bot = await Bot.findById(id, 'faqs name');
		if (!bot) {
			return notFoundError('Bot not found');
		}

		return apiSuccess(
			{ faqs: bot.faqs || [], count: bot.faqs?.length || 0 },
			`FAQs for bot "${bot.name}" fetched successfully`
		);
	} catch (error) {
		console.error('Error fetching FAQs:', error);
		return serverError('Failed to fetch FAQs');
	}
}

/**
 * POST /api/bots/:id/faqs
 * Create a new FAQ (auth required, owner only)
 */
export async function POST(request, { params }) {
	try {
		await connect();
		const { userId } = await auth();

		if (!userId) {
			return authError('Authentication required');
		}

		const { id } = await params;
		const body = await request.json();
		const { question, answer, keywords, enabled = true } = body;

		// Validation
		if (!question || !answer) {
			return validationError('Question and answer are required');
		}

		if (question.length < 3 || question.length > 500) {
			return validationError('Question must be between 3 and 500 characters');
		}

		if (answer.length < 3 || answer.length > 2000) {
			return validationError('Answer must be between 3 and 2000 characters');
		}

		// Find bot and verify ownership
		const bot = await Bot.findById(id);
		if (!bot) {
			return notFoundError('Bot not found');
		}

		if (bot.ownerId !== userId) {
			return forbiddenError('You do not have permission to modify this bot');
		}

		// Check if auto-generate keywords
		const { searchParams } = new URL(request.url);
		const genKeywords = searchParams.get('genKeywords') === 'true';

		let finalKeywords = keywords;
		if (genKeywords || !keywords || keywords.length === 0) {
			finalKeywords = generateKeywords(question);
		}

		// Create new FAQ
		const newFaq = {
			question: question.trim(),
			answer: answer.trim(),
			keywords: finalKeywords,
			enabled,
		};

		bot.faqs.push(newFaq);
		await bot.save();

		// Get the created FAQ with its _id
		const createdFaq = bot.faqs[bot.faqs.length - 1];

		return apiSuccess({ faq: createdFaq }, 'FAQ created successfully');
	} catch (error) {
		console.error('Error creating FAQ:', error);
		return serverError('Failed to create FAQ');
	}
}
