import { createOpenAIClient } from '../integrations/openai.js';
import { logError, logInfo, logWarn } from '../utils/logger.js';

const INTENT_TYPES = {
	NEEDS_RAG: 'NEEDS_RAG',
	GENERAL_CHAT: 'GENERAL_CHAT',
	SMALL_TALK: 'SMALL_TALK',
};

const CONFIDENCE_THRESHOLD = 0.7;

class IntentClassifier {
	/**
	 * Classify user query intent using GPT-3.5-turbo
	 * @param {string} query - User's message
	 * @param {Object} bot - Bot object with description/purpose
	 * @returns {Promise<{type: string, confidence: number}>}
	 */
	async classify(query, bot) {
		try {
			const client = createOpenAIClient();

			const systemPrompt = `You are an intent classifier. Analyze the user's message and classify it into ONE of these categories:

1. NEEDS_RAG - User is asking for specific information that would require searching through documents/knowledge base
   Examples: "What is the refund policy?", "Show me pricing details", "How do I integrate the API?"

2. GENERAL_CHAT - General questions about the topic that can be answered without specific documents
   Examples: "What can you help me with?", "Tell me about your service", "Can you explain what you do?"

3. SMALL_TALK - Greetings, thanks, casual conversation
   Examples: "Hello", "Hi there", "Thank you", "Thanks!", "Goodbye"

Bot Context: ${bot.description || bot.name || 'General assistant'}

Respond ONLY with a JSON object in this exact format:
{"type": "NEEDS_RAG", "confidence": 0.95}

Use confidence score 0-1 based on how certain you are.`;

			const response = await client.chat.completions.create({
				model: 'gpt-3.5-turbo',
				messages: [
					{ role: 'system', content: systemPrompt },
					{ role: 'user', content: query },
				],
				temperature: 0.1,
				max_tokens: 50,
			});

			const result = JSON.parse(response.choices[0].message.content.trim());

			// Validate response
			if (!Object.values(INTENT_TYPES).includes(result.type)) {
				logWarn('Invalid intent type from classifier, defaulting to NEEDS_RAG');
				return { type: INTENT_TYPES.NEEDS_RAG, confidence: 0.5 };
			}

			// If confidence is low, default to RAG (safer)
			if (result.confidence < CONFIDENCE_THRESHOLD) {
				logInfo(
					`Low confidence (${result.confidence}) for intent, defaulting to NEEDS_RAG`
				);
				return { type: INTENT_TYPES.NEEDS_RAG, confidence: result.confidence };
			}

			logInfo(
				`Intent classified: ${result.type} (confidence: ${result.confidence})`
			);
			return result;
		} catch (error) {
			logError('Error in intent classification:', error);
			// On error, default to RAG to avoid missing important queries
			return { type: INTENT_TYPES.NEEDS_RAG, confidence: 0.0 };
		}
	}
}

// Export singleton instance
const intentClassifier = new IntentClassifier();
export default intentClassifier;
export { INTENT_TYPES };
