// File processing job handler
import { downloadFile } from '../../integrations/s3.js';
import { extractText } from '../../processors/textExtractor.js';
import { chunkText } from '../../processors/chunker.js';
import File from '../../../models/File.js';
import Bot from '../../../models/Bot.js';
import connect from '../../integrations/mongo.js';
import apiKeyService from '../../core/apiKeyService.js';
import { ragService } from '../../core/ragService.js';

/**
 * Process a file job: download -> extract -> chunk -> embed -> store
 * @param {Job} job - BullMQ Job instance
 * @returns {Promise<Object>} Processing result
 */
export async function processFileJob(job) {
	const { fileId, botId, userId, s3Key, filename, mimeType, size } = job.data;

	await connect();

	try {
		await File.findByIdAndUpdate(fileId, {
			processingStartedAt: new Date(),
			embeddingStatus: 'processing',
		});

		// Step 1: Download file from S3 (10%)
		await job.updateProgress(10);
		console.log(`[PROCESSOR] Downloading file from S3: ${s3Key}`);
		const fileBuffer = await downloadFile(s3Key);

		// Validate buffer after download
		if (!fileBuffer || fileBuffer.length === 0) {
			throw new Error(
				`Downloaded file buffer is empty or null. S3 Key: ${s3Key}, Buffer length: ${
					fileBuffer?.length || 0
				}`
			);
		}

		console.log(
			`[PROCESSOR] Downloaded buffer size: ${(fileBuffer.length / 1024).toFixed(
				2
			)} KB (${fileBuffer.length} bytes)`
		);

		// Validate buffer size matches expected size (if available)
		if (size && fileBuffer.length !== size) {
			console.warn(`[PROCESSOR] Buffer size mismatch:`, {
				filename,
				expectedSize: size,
				actualSize: fileBuffer.length,
				difference: size - fileBuffer.length,
			});
		}

		// Step 2: Extract text from file (30%)
		await job.updateProgress(30);
		console.log(`[PROCESSOR] Extracting text from file: ${filename}`);
		const extractedText = await extractText(mimeType, fileBuffer, filename);

		if (!extractedText || extractedText.trim().length === 0) {
			throw new Error('No text could be extracted from file');
		}

		// Step 3: Chunk the text (40%)
		await job.updateProgress(40);
		console.log(`[PROCESSOR] Chunking text for file: ${filename}`);

		const metadata = {
			source: filename,
			type: mimeType,
			fileId: fileId,
			botId,
		};

		const chunks = await chunkText(extractedText, metadata, {
			maxChunkSize: 700,
			overlap: 100,
		});

		console.log(`[PROCESSOR] Generated ${chunks.length} chunks`);

		// Step 4: Get bot's API key (50%)
		await job.updateProgress(50);
		const keyData = await apiKeyService.getApiKey(botId, userId);

		if (!keyData.apiKey) {
			throw new Error('No API key available for processing');
		}

		// Step 5: Generate embeddings and store (60-90%)
		await job.updateProgress(60);
		console.log(`[PROCESSOR] Generating embeddings and storing in Qdrant...`);

		const result = await ragService.storeDocuments(
			botId,
			keyData.apiKey,
			chunks,
			{
				fileId,
			}
		);

		console.log(`[PROCESSOR] Stored ${result.storedCount} embeddings`);

		// Step 6: Calculate tokens and cost
		const totalTokens = chunks.reduce((sum, chunk) => {
			return sum + (chunk.metadata?.tokenCount || 0);
		}, 0);

		const estimatedCost = (totalTokens / 1000) * 0.00002; // OpenAI pricing

		// Step 7: Update file record (95%)
		await job.updateProgress(95);
		await File.findByIdAndUpdate(fileId, {
			embeddingStatus: 'completed',
			totalChunks: chunks.length,
			embeddingTokens: totalTokens,
			estimatedCost,
			processedAt: new Date(),
			embeddedAt: new Date(),
		});

		// Step 8: Update bot analytics
		await Bot.findByIdAndUpdate(botId, {
			$inc: {
				'analytics.totalEmbeddings': chunks.length,
				'analytics.totalTokensUsed': totalTokens,
				'analytics.storageUsed': size,
				fileCount: 1,
			},
		});

		console.log(`✅ [PROCESSOR] File processing completed: ${filename}`);

		return {
			success: true,
			fileId,
			chunks: chunks.length,
			tokens: totalTokens,
			cost: estimatedCost,
		};
	} catch (error) {
		console.error(`❌ [PROCESSOR] Error processing file ${fileId}:`, error);

		// Update file status to failed
		await File.findByIdAndUpdate(fileId, {
			embeddingStatus: 'failed',
			processingError: error.message,
		});

		throw error;
	}
}
