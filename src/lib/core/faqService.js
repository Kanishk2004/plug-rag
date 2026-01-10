/**
 * FAQ Service
 * Provides FAQ context for AI responses instead of keyword matching
 */
class FAQService {
	/**
	 * Build FAQ context string for inclusion in AI prompts
	 * @param {Object} bot - Bot object with optional faqs array
	 * @returns {string} Formatted FAQ context or empty string
	 */
	buildFAQContext(bot) {
		if (!bot || !bot.faqs || !Array.isArray(bot.faqs) || bot.faqs.length === 0) {
			return '';
		}

		// Filter enabled FAQs
		const enabledFaqs = bot.faqs.filter((faq) => faq.enabled !== false);

		if (enabledFaqs.length === 0) {
			return '';
		}

		// Format FAQs for prompt
		const faqList = enabledFaqs
			.map((faq, index) => {
				const question = faq.question || faq.keywords?.join(', ') || 'N/A';
				const answer = faq.answer || 'N/A';
				return `${index + 1}. Q: ${question}\n   A: ${answer}`;
			})
			.join('\n\n');

		return `\nFREQUENTLY ASKED QUESTIONS:\nUse these FAQs to guide your responses when relevant:\n\n${faqList}`;
	}
}

// Export singleton instance
const faqService = new FAQService();
export default faqService;
