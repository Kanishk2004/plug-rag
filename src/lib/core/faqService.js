import logger from '../utils/logger.js';

// System-level FAQs (common across all bots)
const SYSTEM_FAQS = [
	{
		keywords: ['hello', 'hi', 'hey', 'greetings'],
		answer:
			"Hello! I'm here to help you find information. What can I assist you with?",
	},
	{
		keywords: ['thank', 'thanks', 'appreciate'],
		answer: "You're welcome! Let me know if you need anything else.",
	},
	{
		keywords: ['bye', 'goodbye', 'see you'],
		answer: 'Goodbye! Feel free to come back if you have more questions.',
	},
	{
		keywords: ['how are you', 'how do you do'],
		answer: "I'm doing well, thank you! How can I help you today?",
	},
];

class FAQService {
	/**
	 * Check if query matches any FAQ (system or bot-specific)
	 * @param {string} query - User's message
	 * @param {Object} bot - Bot object with optional faqs array
	 * @returns {string|null} FAQ answer or null if no match
	 */
	checkFAQ(query, bot = null) {
		const normalizedQuery = query.toLowerCase().trim();

		// Check system FAQs first
		const systemMatch = this._findMatch(normalizedQuery, SYSTEM_FAQS);
		if (systemMatch) {
			logger.info('Matched system FAQ');
			return systemMatch;
		}

		// Check bot-specific FAQs if available
		if (bot && bot.faqs && Array.isArray(bot.faqs)) {
			const botFaqs = bot.faqs
				.filter((faq) => faq.enabled !== false)
				.map((faq) => ({
					keywords: faq.keywords || [],
					answer: faq.answer,
				}));

			const botMatch = this._findMatch(normalizedQuery, botFaqs);
			if (botMatch) {
				logger.info('Matched bot-specific FAQ');
				return botMatch;
			}
		}

		return null;
	}

	/**
	 * Find matching FAQ using keyword matching
	 * @private
	 */
	_findMatch(query, faqs) {
		for (const faq of faqs) {
			// Check if any keyword is present in the query
			const hasMatch = faq.keywords.some((keyword) =>
				query.includes(keyword.toLowerCase())
			);

			if (hasMatch) {
				return faq.answer;
			}
		}
		return null;
	}
}

// Export singleton instance
const faqService = new FAQService();
export default faqService;
