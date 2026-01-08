/**
 * Text Chunking Processor
 *
 * Handles intelligent text segmentation using recursive character splitting
 * optimized for different content types and embedding models.
 */

import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
import { encoding_for_model } from 'tiktoken';
import { logInfo, logError } from '../utils/logger.js';

const DEFAULT_CHUNK_SIZE = 700;
const DEFAULT_CHUNK_OVERLAP = 100;
const DEFAULT_SEPARATORS = ['\n\n', '\n', ' ', ''];

/**
 * Chunk text into LangChain Document objects
 * @param {string} text - Text to chunk
 * @param {Object} metadata - Base metadata for all chunks
 * @param {Object} options - Chunking options
 * @returns {Promise<Array<Document>>} Array of document chunks
 */
export async function chunkText(text, metadata = {}, options = {}) {
	if (!text || typeof text !== 'string') {
		throw new Error('Text content is required and must be a string');
	}

	const {
		maxChunkSize = DEFAULT_CHUNK_SIZE,
		overlap = DEFAULT_CHUNK_OVERLAP,
		separators = DEFAULT_SEPARATORS,
		contentType = 'text',
	} = options;

	logInfo('Starting text chunking', {
		textLength: text.length,
		maxChunkSize,
		overlap,
		contentType,
	});

	try {
		// Get optimal separators based on content type
		const optimalSeparators = getOptimalSeparators(contentType, separators);

		// Create text splitter with configuration
		const splitter = new RecursiveCharacterTextSplitter({
			chunkSize: maxChunkSize,
			chunkOverlap: overlap,
			separators: optimalSeparators,
		});

		const startTime = Date.now();

		// Split the text into chunks
		const textChunks = await splitter.splitText(text);

		const processingTime = Date.now() - startTime;

		if (textChunks.length === 0) {
			throw new Error(
				'Text splitting resulted in no chunks - content may be too short'
			);
		}

		// Calculate token usage for all chunks
		const totalTokens = calculateTotalTokens(textChunks);

		// Create LangChain Document objects with enriched metadata
		const documents = textChunks.map((chunk, index) => {
			const chunkTokens = getAccurateTokenCount(chunk);

			const enrichedMetadata = {
				...metadata,
				totalChunks: textChunks.length,
				chunkSize: chunk.length,
				tokenCount: chunkTokens,
				chunkOverlap: overlap,
				maxChunkSize,
				contentType,
			};

			return new Document({
				pageContent: chunk,
				metadata: enrichedMetadata,
			});
		});

		logInfo('Text chunking completed', {
			originalLength: text.length,
			totalChunks: documents.length,
			avgChunkSize: Math.round(text.length / documents.length),
			totalTokens,
			processingTime: `${processingTime}ms`,
		});

		return documents;
	} catch (error) {
		logError('Text chunking failed', { error: error.message });
		throw error;
	}
}

/**
 * Get optimal separators based on content type
 * @param {string} contentType - Type of content being chunked
 * @param {Array} defaultSeparators - Default separators to fall back to
 * @returns {Array} Optimal separators for the content type
 */
function getOptimalSeparators(contentType, defaultSeparators) {
	switch (contentType.toLowerCase()) {
		case 'markdown':
		case 'md':
			return ['\n## ', '\n### ', '\n#### ', '\n\n', '\n', ' ', ''];

		case 'code':
		case 'javascript':
		case 'python':
			return ['\nfunction ', '\nclass ', '\ndef ', '\n\n', '\n', ' ', ''];

		case 'html':
			return ['</div>', '</p>', '</section>', '\n\n', '\n', ' ', ''];

		case 'csv':
			return ['\n', ',', ' ', ''];

		case 'pdf':
			return ['\n\n', '\n', '. ', ' ', ''];

		default:
			return defaultSeparators;
	}
}

/**
 * Calculate accurate token count for text using tiktoken
 * @param {string} text - Text to count tokens for
 * @param {string} model - Model name for token encoding
 * @returns {number} Token count
 */
export function getAccurateTokenCount(text, model = 'text-embedding-3-small') {
	try {
		// Use tiktoken for accurate token counting
		const encoder = encoding_for_model(model);
		const tokens = encoder.encode(text);
		encoder.free(); // Clean up encoder
		return tokens.length;
	} catch (error) {
		// Fallback to rough estimation if tiktoken fails
		logError('Token counting failed, using estimation', {
			error: error.message,
		});
		return Math.ceil(text.length / 4); // Rough estimate: ~4 chars per token
	}
}

/**
 * Calculate total tokens for an array of text chunks
 * @param {Array} chunks - Array of text chunks
 * @param {string} model - Model name for token encoding
 * @returns {number} Total token count
 */
function calculateTotalTokens(chunks, model = 'text-embedding-3-small') {
	return chunks.reduce((total, chunk) => {
		return total + getAccurateTokenCount(chunk, model);
	}, 0);
}
