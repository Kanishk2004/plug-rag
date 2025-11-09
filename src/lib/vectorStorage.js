import { generateEmbedding } from './embeddings.js';
import { createBotCollection } from './qdrant.js';
import Bot from '@/models/Bot.js';
import File from '@/models/File.js';
import Chunk from '@/models/Chunk.js';
import { randomUUID } from 'crypto';
// Vector storage with comprehensive logging

/**
 * Vector storage service that handles the complete flow:
 * 1. Generate embeddings for chunks
 * 2. Store vectors in Qdrant
 * 3. Update MongoDB records
 * 
 * Enhanced with comprehensive logging and error handling
 */

// Performance and logging utilities
const logger = {
  info: (message, data = {}) => console.log(`[VECTOR-STORAGE] ℹ️  ${message}`, data),
  success: (message, data = {}) => console.log(`[VECTOR-STORAGE] ✅ ${message}`, data),
  warning: (message, data = {}) => console.warn(`[VECTOR-STORAGE] ⚠️  ${message}`, data),
  error: (message, error = {}) => console.error(`[VECTOR-STORAGE] ❌ ${message}`, error),
  debug: (message, data = {}) => console.log(`[VECTOR-STORAGE] 🐛 DEBUG: ${message}`, data),
  performance: (operation, duration, data = {}) => 
    console.log(`[VECTOR-STORAGE] ⏱️  ${operation} completed in ${duration}ms`, data)
};

const timer = {
  start: (operation) => {
    const startTime = Date.now();
    logger.debug(`Starting operation: ${operation}`);
    return {
      end: () => {
        const duration = Date.now() - startTime;
        logger.performance(operation, duration);
        return duration;
      }
    };
  }
};

/**
 * Initialize vector storage for a new bot
 * Creates Qdrant collection with proper configuration
 */
export async function initializeBotVectorStorage(userId, botId) {
	const operationTimer = timer.start('initializeBotVectorStorage');
	
	try {
		logger.info('Initializing vector storage for bot', { userId, botId });

		// Validate inputs
		if (!userId || !botId) {
			throw new Error('Missing required parameters: userId and botId');
		}

		logger.debug('Creating Qdrant collection for bot');
		const collectionResult = await createBotCollection(userId, botId);
		logger.success('Qdrant collection created/verified', {
			collectionName: collectionResult.collectionName,
			existed: collectionResult.existed
		});

		// Update bot document with vector storage configuration
		logger.debug('Updating bot document with vector storage config');
		const botUpdate = await Bot.findByIdAndUpdate(botId, {
			'vectorStorage.enabled': true,
			'vectorStorage.collectionName': collectionResult.collectionName,
			'vectorStorage.provider': 'qdrant',
			'vectorStorage.dimensions': 1536, // text-embedding-3-small dimensions
			'vectorStorage.model': 'text-embedding-3-small',
			'vectorStorage.createdAt': new Date(),
			'vectorStorage.status': 'active'
		}, { new: true });

		if (!botUpdate) {
			throw new Error('Failed to update bot document with vector storage config');
		}

		logger.success('Bot vector storage initialized successfully', {
			botId,
			collectionName: collectionResult.collectionName,
			existed: collectionResult.existed
		});

		operationTimer.end();

		return {
			success: true,
			collectionName: collectionResult.collectionName,
			existed: collectionResult.existed,
			status: 'active'
		};
	} catch (error) {
		logger.error('Failed to initialize bot vector storage', {
			userId,
			botId,
			error: error.message,
			stack: error.stack
		});
		operationTimer.end();
		throw new Error(`Failed to initialize vector storage: ${error.message}`);
	}
}

/**
 * Process file chunks and generate embeddings with Qdrant storage
 * Industry-standard implementation with comprehensive error handling
 */
export async function processFileToVectors(userId, botId, fileId) {
	const operationTimer = timer.start('processFileToVectors');
	
	try {
		logger.info('Starting file to vectors processing', { userId, botId, fileId });

		// Validate inputs
		if (!userId || !botId || !fileId) {
			throw new Error('Missing required parameters: userId, botId, or fileId');
		}

		// Get file from MongoDB with validation
		logger.debug('Fetching file from database');
		const file = await File.findById(fileId);
		if (!file) {
			throw new Error(`File not found with ID: ${fileId}`);
		}

		logger.debug('File retrieved, checking ownership', {
			fileOwnerId: file.ownerId,
			fileBotId: file.botId?.toString(),
			providedUserId: userId,
			providedBotId: botId?.toString(),
			fileOwnerIdType: typeof file.ownerId,
			fileBotIdType: typeof file.botId,
			providedUserIdType: typeof userId,
			providedBotIdType: typeof botId
		});

		// Validate file ownership (convert ObjectIds to strings for comparison)
		const fileOwnerIdStr = file.ownerId?.toString();
		const fileBotIdStr = file.botId?.toString();
		const userIdStr = userId?.toString();
		const botIdStr = botId?.toString();

		if (fileOwnerIdStr !== userIdStr || fileBotIdStr !== botIdStr) {
			logger.error('File ownership validation failed', {
				fileOwnerId: fileOwnerIdStr,
				fileBotId: fileBotIdStr,
				providedUserId: userIdStr,
				providedBotId: botIdStr,
				ownerIdMatch: fileOwnerIdStr === userIdStr,
				botIdMatch: fileBotIdStr === botIdStr
			});
			throw new Error('File ownership validation failed');
		}

		logger.success('File ownership validation passed');

		logger.success('File retrieved successfully', {
			fileName: file.originalName,
			fileType: file.fileType,
			fileSize: file.size,
			status: file.status
		});

		// Update file status to processing
		await File.findByIdAndUpdate(fileId, {
			status: 'processing',
			embeddingStatus: 'processing',
			'processing.startedAt': new Date(),
			'processing.stage': 'fetching_chunks'
		});

		// Get or create chunks for this file
		logger.debug('Fetching chunks for file processing');
		const chunks = await getOrCreateChunks(file);
		
		if (chunks.length === 0) {
			throw new Error('No chunks available for processing');
		}

		logger.success('Chunks prepared for processing', {
			chunkCount: chunks.length,
			totalTokens: chunks.reduce((sum, chunk) => sum + (chunk.tokens || 0), 0)
		});

		// Process chunks to vectors with Qdrant storage
		const result = await processChunksToVectors(chunks, userId, botId, file);
		
		operationTimer.end();
		return result;

	} catch (error) {
		logger.error('Error in processFileToVectors', {
			userId,
			botId,
			fileId,
			error: error.message,
			stack: error.stack
		});

		// Update file status to failed
		try {
			await File.findByIdAndUpdate(fileId, {
				status: 'failed',
				embeddingStatus: 'failed',
				'processing.error': error.message,
				'processing.failedAt': new Date()
			});
			logger.debug('File status updated to failed');
		} catch (updateError) {
			logger.error('Failed to update file status to failed', updateError);
		}

		operationTimer.end();
		throw error;
	}
}

/**
 * Get existing chunks or create them from file content
 * Handles chunking strategy and validation
 */
async function getOrCreateChunks(file) {
	const chunkTimer = timer.start('getOrCreateChunks');
	
	try {
		logger.debug('Checking for existing chunks', { fileId: file._id });
		
		// Try to get existing chunks first
		let chunks = await Chunk.find({ fileId: file._id }).sort({ chunkIndex: 1 });
		
		if (chunks.length > 0) {
			logger.success('Found existing chunks', { count: chunks.length });
			chunkTimer.end();
			return chunks;
		}

		// No chunks found, create them from extracted text
		logger.warning('No chunks found, creating from extracted text');
		
		if (!file.extractedText || file.extractedText.length === 0) {
			throw new Error('No extracted text available for chunking');
		}

		logger.debug('Importing chunking utilities');
		const { chunkText } = await import('@/lib/extractors/index.js');
		
		logger.debug('Creating chunks from text', {
			textLength: file.extractedText.length,
			fileType: file.fileType
		});

		const generatedChunks = chunkText(file.extractedText, {
			metadata: { 
				fileType: file.fileType,
				fileName: file.originalName,
				fileSize: file.size
			},
		});

		if (generatedChunks.length === 0) {
			throw new Error('Chunking process produced no chunks');
		}

		logger.success('Chunks generated successfully', {
			chunkCount: generatedChunks.length,
			avgChunkSize: Math.round(generatedChunks.reduce((sum, c) => sum + c.content.length, 0) / generatedChunks.length)
		});

		// Prepare chunk documents for MongoDB
		const chunkDocuments = generatedChunks.map((chunk, index) => ({
			fileId: file._id,
			botId: file.botId,
			ownerId: file.ownerId,
			content: chunk.content,
			chunkIndex: chunk.chunkIndex !== undefined ? chunk.chunkIndex : index,
			tokens: chunk.tokens || Math.ceil(chunk.content.length / 4),
			type: mapChunkTypeForStorage(chunk.type || 'paragraph_boundary'),
			metadata: {
				...chunk.metadata,
				fileName: file.originalName,
				fileType: file.fileType,
				createdAt: new Date()
			},
			embeddingStatus: 'pending',
			createdAt: new Date()
		}));

		// Save chunks to MongoDB
		logger.debug('Saving chunks to database');
		const savedChunks = await Chunk.insertMany(chunkDocuments);
		
		logger.success('Chunks saved to database', {
			savedCount: savedChunks.length,
			totalTokens: savedChunks.reduce((sum, chunk) => sum + chunk.tokens, 0)
		});

		// Update file with chunk info
		await File.findByIdAndUpdate(file._id, {
			'processing.chunksCreated': savedChunks.length,
			'processing.stage': 'chunks_created'
		});

		chunkTimer.end();
		return savedChunks;

	} catch (error) {
		logger.error('Error in getOrCreateChunks', {
			fileId: file._id,
			error: error.message
		});
		chunkTimer.end();
		throw error;
	}
}

/**
 * Process chunks to vectors with Qdrant storage enabled
 * Industry-standard implementation with batch processing and error recovery
 */
async function processChunksToVectors(chunks, userId, botId, file) {
	const operationTimer = timer.start('processChunksToVectors');
	
	try {
		const fileId = file._id;
		logger.info('Processing chunks to vectors with Qdrant storage', {
			fileId,
			fileName: file.originalName,
			chunkCount: chunks.length
		});

		// Update processing stage
		await File.findByIdAndUpdate(fileId, {
			'processing.stage': 'generating_embeddings'
		});

		// Generate embeddings for chunks with batch processing
		logger.debug('Starting embedding generation phase');
		const embeddingTimer = timer.start('embedding_generation');
		
		const vectors = [];
		let totalTokens = 0;
		const batchSize = 10; // Process embeddings in batches to avoid overwhelming the API
		
		for (let i = 0; i < chunks.length; i += batchSize) {
			const batch = chunks.slice(i, i + batchSize);
			logger.debug(`Processing embedding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`, {
				batchSize: batch.length,
				progress: `${i + batch.length}/${chunks.length}`
			});

			// Process batch with promise handling
			const batchPromises = batch.map(async (chunk, batchIndex) => {
				try {
					logger.debug('Generating embedding for chunk', {
						chunkId: chunk._id,
						chunkIndex: chunk.chunkIndex,
						contentLength: chunk.content?.length,
						contentPreview: chunk.content?.substring(0, 100) + '...'
					});

					// Validate and truncate chunk content if necessary
					let chunkContent = chunk.content;
					
					// Estimate tokens (4 characters ≈ 1 token for OpenAI)
					const estimatedTokens = Math.ceil(chunkContent.length / 4);
					const maxEmbeddingTokens = 8000; // Conservative limit for text-embedding-3-small (8192 limit)
					
					if (estimatedTokens > maxEmbeddingTokens) {
						logger.warning('Chunk exceeds embedding token limit, truncating', {
							chunkId: chunk._id,
							originalLength: chunkContent.length,
							estimatedTokens,
							maxTokens: maxEmbeddingTokens
						});
						
						// Truncate to fit within token limit
						const maxChars = maxEmbeddingTokens * 4;
						chunkContent = chunkContent.substring(0, maxChars);
						
						logger.debug('Chunk truncated for embedding', {
							chunkId: chunk._id,
							newLength: chunkContent.length,
							newEstimatedTokens: Math.ceil(chunkContent.length / 4)
						});
					}

					const embeddingResult = await generateEmbedding(chunkContent);
					
					logger.debug('Embedding result received', {
						chunkId: chunk._id,
						success: embeddingResult?.success,
						dimensions: embeddingResult?.dimensions,
						model: embeddingResult?.model,
						hasEmbedding: !!embeddingResult?.embedding
					});

					// Extract embedding from result object
					const embedding = embeddingResult.embedding;
					
					// Validate embedding (text-embedding-3-small typically has 1536 dimensions)
					if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
						logger.error('Invalid embedding generated for chunk', {
							chunkId: chunk._id,
							embeddingExists: !!embedding,
							embeddingIsArray: Array.isArray(embedding),
							embeddingLength: embedding?.length,
							embeddingResult: {
								success: embeddingResult?.success,
								dimensions: embeddingResult?.dimensions,
								model: embeddingResult?.model
							}
						});
						throw new Error(`Invalid embedding generated for chunk ${chunk._id}`);
					}

					// Log actual dimensions for debugging (only for first chunk to avoid spam)
					if (i === 0 && batchIndex === 0) {
						logger.info('Embedding dimensions detected', {
							actualDimensions: embedding.length,
							expectedDimensions: '1536 (text-embedding-3-small)',
							model: embeddingResult?.model,
							isValidLength: embedding.length > 0
						});
					}

					const vector = {
						id: randomUUID(), // Generate proper UUID for Qdrant compatibility
						vector: embedding, // Qdrant expects 'vector' not 'embedding'
						payload: {
							content: chunk.content,
							fileId: fileId.toString(),
							fileName: file.originalName,
							chunkId: chunk._id.toString(), // Keep the original chunk ID in payload for reference
							chunkIndex: chunk.chunkIndex,
							tokens: chunk.tokens,
							chunkType: chunk.type,
							metadata: {
								...chunk.metadata,
								userId,
								botId,
								createdAt: new Date().toISOString()
							}
						}
					};

					// Update chunk status to embedding generated
					await Chunk.findByIdAndUpdate(chunk._id, {
						embeddingStatus: 'generated',
						'processing.embeddedAt': new Date()
					});

					logger.debug(`Embedding generated for chunk ${chunk.chunkIndex}`, {
						chunkId: chunk._id,
						contentLength: chunk.content.length,
						embeddingDimensions: embedding.length
					});

					return vector;
				} catch (embeddingError) {
					logger.error(`Failed to generate embedding for chunk ${chunk._id}`, {
						chunkId: chunk._id,
						chunkIndex: chunk.chunkIndex,
						error: embeddingError.message
					});

					// Update chunk status to failed
					await Chunk.findByIdAndUpdate(chunk._id, {
						embeddingStatus: 'failed',
						'processing.error': embeddingError.message
					});

					throw embeddingError;
				}
			});

			// Wait for batch to complete
			const batchVectors = await Promise.all(batchPromises);
			vectors.push(...batchVectors);
			totalTokens += batch.reduce((sum, chunk) => sum + (chunk.tokens || 0), 0);

			// Small delay between batches to avoid rate limits
			if (i + batchSize < chunks.length) {
				await new Promise(resolve => setTimeout(resolve, 100));
			}
		}

		embeddingTimer.end();
		logger.success('All embeddings generated successfully', {
			vectorCount: vectors.length,
			totalTokens,
			avgTokensPerChunk: Math.round(totalTokens / vectors.length)
		});

		// Update processing stage
		await File.findByIdAndUpdate(fileId, {
			'processing.stage': 'storing_vectors',
			'processing.embeddingsGenerated': vectors.length,
			'processing.embeddingTokens': totalTokens
		});

		// Store vectors in Qdrant
		logger.info('Starting Qdrant vector storage');
		const qdrantTimer = timer.start('qdrant_storage');
		
		try {
			// Get bot's collection name
			const bot = await Bot.findById(botId);
			if (!bot || !bot.vectorStorage?.collectionName) {
				throw new Error('Bot vector storage not properly initialized');
			}

			const collectionName = bot.vectorStorage.collectionName;
			logger.debug('Storing vectors in Qdrant collection', {
				collectionName,
				vectorCount: vectors.length
			});

			// Import Qdrant functions
			const { upsertVectors } = await import('./qdrant.js');
			
			// Store vectors in batches for better performance
			const qdrantBatchSize = 100; // Qdrant can handle larger batches
			let storedCount = 0;

			for (let i = 0; i < vectors.length; i += qdrantBatchSize) {
				const vectorBatch = vectors.slice(i, i + qdrantBatchSize);
				
				logger.debug(`Storing Qdrant batch ${Math.floor(i / qdrantBatchSize) + 1}/${Math.ceil(vectors.length / qdrantBatchSize)}`, {
					batchSize: vectorBatch.length,
					progress: `${i + vectorBatch.length}/${vectors.length}`
				});

				await upsertVectors(collectionName, vectorBatch);
				storedCount += vectorBatch.length;

				logger.debug('Qdrant batch stored successfully', {
					storedInBatch: vectorBatch.length,
					totalStored: storedCount
				});
			}

			qdrantTimer.end();
			logger.success('All vectors stored in Qdrant', {
				collectionName,
				vectorsStored: storedCount,
				totalVectors: vectors.length
			});

		} catch (qdrantError) {
			logger.error('Failed to store vectors in Qdrant', {
				error: qdrantError.message,
				vectorCount: vectors.length
			});
			throw new Error(`Qdrant storage failed: ${qdrantError.message}`);
		}

		// Update final statuses
		logger.debug('Updating final database statuses');
		
		// Update all chunks to processed
		await Chunk.updateMany(
			{ fileId, embeddingStatus: 'generated' },
			{
				embeddingStatus: 'processed',
				'processing.processedAt': new Date()
			}
		);

		// Update file status
		await File.findByIdAndUpdate(fileId, {
			status: 'processed',
			embeddingStatus: 'processed',
			embeddedAt: new Date(),
			vectorCount: vectors.length,
			'processing.completedAt': new Date(),
			'processing.stage': 'completed',
			'processing.tokensUsed': totalTokens
		});

		// Update bot analytics
		await Bot.findByIdAndUpdate(botId, {
			$inc: {
				'analytics.totalEmbeddings': vectors.length,
				'analytics.totalTokensUsed': totalTokens,
				'analytics.totalFiles': 1
			},
			'analytics.lastProcessedAt': new Date()
		});

		operationTimer.end();
		
		logger.success('File processing completed successfully', {
			fileId,
			fileName: file.originalName,
			vectorsStored: vectors.length,
			tokensUsed: totalTokens,
			processingTime: operationTimer.end()
		});

		return {
			success: true,
			fileId,
			fileName: file.originalName,
			vectorsStored: vectors.length,
			tokensUsed: totalTokens,
			message: 'File processed and vectors stored successfully in Qdrant'
		};

	} catch (error) {
		logger.error('Error processing chunks to vectors', {
			fileId: file._id,
			fileName: file.originalName,
			error: error.message,
			stack: error.stack
		});

		// Update file status to failed
		try {
			await File.findByIdAndUpdate(file._id, {
				status: 'failed',
				embeddingStatus: 'failed',
				'processing.error': error.message,
				'processing.failedAt': new Date(),
				'processing.stage': 'failed'
			});
		} catch (updateError) {
			logger.error('Error updating file status to failed', updateError);
		}

		operationTimer.end();
		throw new Error(`Failed to process chunks to vectors: ${error.message}`);
	}
}

/**
 * Map chunk types from extractors to valid Chunk model enum values
 * Ensures compatibility between extraction and storage systems
 */
function mapChunkTypeForStorage(extractorType) {
	const typeMapping = {
		paragraph_boundary: 'paragraph_boundary',
		sentence_boundary: 'sentence_boundary',
		document_structure: 'document_structure',
		manual: 'manual',
		// Map additional extractor types to valid enum values
		final_chunk: 'paragraph_boundary',
		structured_section: 'document_structure',
		section: 'document_structure',
		list_item: 'paragraph_boundary',
		heading: 'document_structure',
		table_row: 'document_structure',
		table: 'document_structure',
		code_block: 'paragraph_boundary',
		quote: 'paragraph_boundary'
	};

	const mappedType = typeMapping[extractorType] || 'paragraph_boundary';
	logger.debug('Mapped chunk type', { original: extractorType, mapped: mappedType });
	return mappedType;
}

/**
 * Delete file vectors from Qdrant and update MongoDB
 */
export async function deleteFileVectors(userId, botId, fileId) {
	const operationTimer = timer.start('deleteFileVectors');
	
	try {
		logger.info('Deleting file vectors', { userId, botId, fileId });

		// Validate inputs
		if (!userId || !botId || !fileId) {
			throw new Error('Missing required parameters for vector deletion');
		}

		// Get bot collection info
		const bot = await Bot.findById(botId);
		if (!bot || !bot.vectorStorage?.collectionName) {
			logger.warning('Bot has no vector storage configured', { botId });
			return { success: true, message: 'No vector storage to clean up' };
		}

		// Get chunks to delete
		const chunks = await Chunk.find({ fileId, botId, ownerId: userId });
		if (chunks.length === 0) {
			logger.warning('No chunks found to delete', { fileId });
			return { success: true, message: 'No chunks to delete' };
		}

		const chunkIds = chunks.map(chunk => chunk._id.toString());
		logger.debug('Found chunks to delete', { count: chunkIds.length });

		// Delete from Qdrant
		try {
			const { deleteVectors } = await import('./qdrant.js');
			await deleteVectors(bot.vectorStorage.collectionName, chunkIds);
			logger.success('Vectors deleted from Qdrant', { 
				collectionName: bot.vectorStorage.collectionName,
				deletedCount: chunkIds.length 
			});
		} catch (qdrantError) {
			logger.error('Failed to delete vectors from Qdrant', qdrantError);
			// Continue with MongoDB cleanup even if Qdrant fails
		}

		// Delete chunks from MongoDB
		const deleteResult = await Chunk.deleteMany({ fileId, botId, ownerId: userId });
		logger.success('Chunks deleted from MongoDB', { deletedCount: deleteResult.deletedCount });

		// Update bot analytics
		await Bot.findByIdAndUpdate(botId, {
			$inc: {
				'analytics.totalEmbeddings': -chunkIds.length
			}
		});

		operationTimer.end();
		
		return { 
			success: true, 
			deletedVectors: chunkIds.length,
			message: 'File vectors deleted successfully' 
		};

	} catch (error) {
		logger.error('Error deleting file vectors', {
			userId, botId, fileId,
			error: error.message
		});
		operationTimer.end();
		throw new Error(`Failed to delete file vectors: ${error.message}`);
	}
}

/**
 * Search for similar content in Qdrant
 */
export async function searchSimilarContent(userId, botId, query, options = {}) {
	const operationTimer = timer.start('searchSimilarContent');
	
	try {
		logger.info('Searching for similar content', { userId, botId, queryLength: query.length });

		// Validate inputs
		if (!userId || !botId || !query) {
			throw new Error('Missing required parameters for search');
		}

		// Get bot collection info
		const bot = await Bot.findById(botId);
		if (!bot || !bot.vectorStorage?.collectionName) {
			throw new Error('Bot vector storage not configured');
		}

		// Generate query embedding
		logger.debug('Generating query embedding');
		const queryEmbedding = await generateEmbedding(query);
		
		// Search in Qdrant
		const { searchVectors } = await import('./qdrant.js');
		const searchResults = await searchVectors(
			bot.vectorStorage.collectionName,
			queryEmbedding,
			{
				limit: options.limit || 10,
				scoreThreshold: options.scoreThreshold || 0.7,
				filter: {
					must: [
						{ key: 'metadata.userId', match: { value: userId } },
						{ key: 'metadata.botId', match: { value: botId } }
					]
				}
			}
		);

		logger.success('Search completed', {
			resultsCount: searchResults.length,
			topScore: searchResults[0]?.score || 0
		});

		operationTimer.end();
		
		return {
			success: true,
			results: searchResults,
			query,
			resultCount: searchResults.length
		};

	} catch (error) {
		logger.error('Error searching similar content', {
			userId, botId,
			error: error.message
		});
		operationTimer.end();
		throw new Error(`Search failed: ${error.message}`);
	}
}

/**
 * Cleanup bot vector storage
 */
export async function cleanupBotVectorStorage(userId, botId) {
	const operationTimer = timer.start('cleanupBotVectorStorage');
	
	try {
		logger.info('Cleaning up bot vector storage', { userId, botId });

		const bot = await Bot.findById(botId);
		if (!bot || !bot.vectorStorage?.collectionName) {
			logger.warning('Bot has no vector storage to cleanup', { botId });
			return { success: true, message: 'No vector storage to cleanup' };
		}

		// Delete Qdrant collection
		try {
			const { deleteCollection } = await import('./qdrant.js');
			await deleteCollection(bot.vectorStorage.collectionName);
			logger.success('Qdrant collection deleted', { 
				collectionName: bot.vectorStorage.collectionName 
			});
		} catch (qdrantError) {
			logger.error('Failed to delete Qdrant collection', qdrantError);
		}

		// Clean up MongoDB chunks
		const chunkDeleteResult = await Chunk.deleteMany({ botId, ownerId: userId });
		
		// Update bot to disable vector storage
		await Bot.findByIdAndUpdate(botId, {
			'vectorStorage.enabled': false,
			'vectorStorage.status': 'disabled',
			'vectorStorage.cleanedAt': new Date()
		});

		logger.success('Bot vector storage cleanup completed', {
			chunksDeleted: chunkDeleteResult.deletedCount
		});

		operationTimer.end();
		
		return { 
			success: true, 
			chunksDeleted: chunkDeleteResult.deletedCount,
			message: 'Bot vector storage cleaned up successfully' 
		};

	} catch (error) {
		logger.error('Error cleaning up bot vector storage', {
			userId, botId,
			error: error.message
		});
		operationTimer.end();
		throw new Error(`Cleanup failed: ${error.message}`);
	}
}

/**
 * Get bot vector storage statistics
 */
export async function getBotVectorStats(userId, botId) {
	const operationTimer = timer.start('getBotVectorStats');
	
	try {
		logger.debug('Getting bot vector statistics', { userId, botId });

		const bot = await Bot.findById(botId);
		if (!bot) {
			throw new Error('Bot not found');
		}

		// Get chunk statistics
		const chunkStats = await Chunk.aggregate([
			{ $match: { botId: new require('mongoose').Types.ObjectId(botId), ownerId: userId } },
			{
				$group: {
					_id: '$embeddingStatus',
					count: { $sum: 1 },
					totalTokens: { $sum: '$tokens' }
				}
			}
		]);

		// Get file statistics
		const fileStats = await File.aggregate([
			{ $match: { botId: new require('mongoose').Types.ObjectId(botId), ownerId: userId } },
			{
				$group: {
					_id: '$embeddingStatus',
					count: { $sum: 1 },
					totalSize: { $sum: '$size' }
				}
			}
		]);

		const stats = {
			vectorStorage: bot.vectorStorage || {},
			chunks: chunkStats,
			files: fileStats,
			analytics: bot.analytics || {},
			overall: bot.vectorStorage?.enabled ? 'active' : 'disabled'
		};

		logger.success('Vector statistics retrieved', { 
			totalChunks: chunkStats.reduce((sum, stat) => sum + stat.count, 0),
			totalFiles: fileStats.reduce((sum, stat) => sum + stat.count, 0)
		});

		operationTimer.end();
		
		return { success: true, stats };

	} catch (error) {
		logger.error('Error getting bot vector stats', {
			userId, botId,
			error: error.message
		});
		operationTimer.end();
		throw new Error(`Failed to get vector stats: ${error.message}`);
	}
}

/**
 * Vector storage health check
 */
export async function vectorStorageHealthCheck() {
	const operationTimer = timer.start('vectorStorageHealthCheck');
	
	try {
		logger.info('Performing vector storage health check');

		// Check Qdrant connection
		let qdrantStatus = 'unknown';
		try {
			const { healthCheck } = await import('./qdrant.js');
			const qdrantHealth = await healthCheck();
			qdrantStatus = qdrantHealth.status;
			logger.success('Qdrant health check passed', qdrantHealth);
		} catch (qdrantError) {
			qdrantStatus = 'failed';
			logger.error('Qdrant health check failed', qdrantError);
		}

		// Check embeddings API
		let embeddingsStatus = 'unknown';
		try {
			const testEmbedding = await generateEmbedding('test');
			embeddingsStatus = testEmbedding && testEmbedding.length === 1536 ? 'healthy' : 'failed';
			logger.success('Embeddings API health check passed');
		} catch (embeddingError) {
			embeddingsStatus = 'failed';
			logger.error('Embeddings API health check failed', embeddingError);
		}

		const overallStatus = qdrantStatus === 'healthy' && embeddingsStatus === 'healthy' ? 'healthy' : 'degraded';

		operationTimer.end();

		return {
			success: true,
			overall: overallStatus,
			components: {
				qdrant: qdrantStatus,
				embeddings: embeddingsStatus
			},
			timestamp: new Date().toISOString()
		};

	} catch (error) {
		logger.error('Error in vector storage health check', error);
		operationTimer.end();
		
		return {
			success: false,
			overall: 'failed',
			error: error.message,
			timestamp: new Date().toISOString()
		};
	}
}
