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
import File from '../models/File.js';
import connectMongo from './mongo.js';

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

	try {
		// Connect to MongoDB
		await connectMongo();

		// Step 1: Create file record in database
		console.log('[FILE-PROCESSOR] Step 1: Creating file record');
		fileRecord = await createFileRecord(file, fileBuffer, botId, userId);

		// Step 2: Extract and chunk content using loader
		console.log('[FILE-PROCESSOR] Step 2: Extracting content');
		documents = await injestFile(file, fileBuffer, {
			maxChunkSize,
			overlap,
		});

		console.log(`[FILE-PROCESSOR] Extracted ${documents.length} chunks`);

		// Update file record with extraction results
		await updateFileProcessingStatus(fileRecord._id, {
			status: 'processing',
			totalChunks: documents.length,
			extractedText: documents.map(doc => doc.pageContent).join(' ').substring(0, 10000), // Store first 10k chars
		});

		// Step 3: Generate embeddings and store in vector DB
		console.log('[FILE-PROCESSOR] Step 3: Storing in vector database');
		const vectorIds = await storeDocumentsForBot(
			botId.toString(),
			documents,
			fileRecord._id // Pass file ID for metadata
		);

		// Step 4: Update file record with final results
		await updateFileProcessingStatus(fileRecord._id, {
			status: 'completed',
			embeddingStatus: 'completed',
			vectorCount: vectorIds?.length || 0,
			embeddedAt: new Date(),
			processedAt: new Date(),
		});

		console.log('[FILE-PROCESSOR] Processing completed successfully');

		return {
			success: true,
			fileId: fileRecord._id,
			chunksCreated: documents.length,
			vectorsCreated: vectorIds?.length || 0,
		};
	} catch (error) {
		console.error('[FILE-PROCESSOR] Processing failed:', {
			fileName: file.name,
			error: error.message,
			stack: error.stack,
		});

		// Rollback: Update file status to 'failed' in DB
		if (fileRecord?._id) {
			await updateFileProcessingStatus(fileRecord._id, {
				status: 'failed',
				embeddingStatus: 'failed',
				processingError: error.message,
			});
		}

		throw new Error(`File processing failed: ${error.message}`);
	}
}

/**
 * Create a new file record in the database
 * @param {File} file - Uploaded file object
 * @param {Buffer} fileBuffer - File content buffer
 * @param {string} botId - Bot ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Created file record
 */
async function createFileRecord(file, fileBuffer, botId, userId) {
	// Determine file type from extension or mime type
	const getFileType = (filename, mimeType) => {
		const ext = filename.toLowerCase().split('.').pop();
		if (ext === 'pdf' || mimeType === 'application/pdf') return 'pdf';
		if (ext === 'docx' || mimeType.includes('wordprocessingml')) return 'docx';
		if (ext === 'csv' || mimeType === 'text/csv') return 'csv';
		if (ext === 'html' || mimeType === 'text/html') return 'html';
		if (ext === 'md' || mimeType === 'text/markdown') return 'md';
		if (ext === 'txt' || mimeType === 'text/plain') return 'txt';
		return 'txt'; // default
	};

	const fileRecord = new File({
		botId: botId,
		ownerId: userId,
		filename: file.name,
		originalName: file.name,
		mimeType: file.type,
		fileType: getFileType(file.name, file.type),
		size: fileBuffer.length,
		status: 'uploaded',
		embeddingStatus: 'pending',
	});

	return await fileRecord.save();
}

/**
 * Update file processing status
 * @param {string} fileId - File record ID
 * @param {Object} updates - Updates to apply
 */
async function updateFileProcessingStatus(fileId, updates) {
	try {
		await File.findByIdAndUpdate(fileId, updates);
		console.log(`[FILE-PROCESSOR] Updated file ${fileId} with:`, updates);
	} catch (error) {
		console.error(`[FILE-PROCESSOR] Failed to update file ${fileId}:`, error);
		// Don't throw here to avoid breaking the main flow
	}
}
