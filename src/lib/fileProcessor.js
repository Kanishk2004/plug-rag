// ⚙️ **File Processor (/lib/fileProcessor.js)** [NEW FILE]
// │   ├── Orchestrates entire processing pipeline
// │   ├── **→ CALL DOCUMENT LOADER**
// │   ├── **→ CALL VECTOR STORE**
// │   ├── Error handling & rollback
// │   └── Return processing results

/**
 * File Processing Orchestrator
 *
 * This module orchestrates the entire file processing pipeline:
 * 1. Document loading and chunking
 * 2. Vector embedding generation
 * 3. Vector store operations
 * 4. Database persistence
 * 5. Error handling and rollback
 */

import { injestFile } from './loader.js';
import { storeDocumentsForBot } from './vectorStore.js';

/**
 * Main file processing function
 *
 * @param {File} file - Uploaded file object
 * @param {Buffer} fileBuffer - File content buffer
 * @param {string} botId - Bot ID
 * @param {string} userId - User ID
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Processing results
 */

export async function processFile(
	file,
	fileBuffer,
	botId,
	userId,
	options = {}
) {
	const {
		generateEmbeddings = true,
		maxChunkSize = 700,
		overlap = 100,
	} = options;

	let fileRecord = null;
	let documents = [];
	let processedDocuments = [];

	try {
		// Step 2: Extract and chunk content using loader
		console.log('[FILE-PROCESSOR] Step 1: Extracting content');
		documents = await injestFile(file, fileBuffer, {
			maxChunkSize,
			overlap,
		});

		console.log(`[FILE-PROCESSOR] Extracted ${documents.length} chunks`);

		// Step 3: Generate embeddings and store in vector DB
		console.log('[FILE-PROCESSOR] Step 2: Storing in vector database');
		const vectorIds = await storeDocumentsForBot(
			botId.toString(),
			documents
		);

		return {
			success: true,
			chunksCreated: documents.length,
			vectorsCreated: vectorIds?.length,
			// fileId: fileRecord._id,
		};
	} catch (error) {
		console.error('[FILE-PROCESSOR] Processing failed:', {
			fileName: file.name,
			error: error.message,
			stack: error.stack,
		});

		// TODO: Rollback: Update file status to 'error' in DB

		throw new Error(`File processing failed: ${error.message}`);
	}
}
