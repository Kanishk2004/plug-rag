/**
 * Document Processing and Chunking Module
 *
 * Processes various file formats (PDF, CSV, TXT, MD, HTML) and converts them into
 * LangChain document chunks for vector storage and retrieval.
 *
 * Returns: Array of LangChain Document objects with the following structure:
 * - pageContent: string (the actual text chunk)
 * - metadata: object containing source, type, size, chunk info, and processing details
 */

// FUNCTIONS WE HAVE
// 1. injestFile(file, fileBuffer, options)
// 2. processFileByType(file, fileBuffer)

import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import Papa from 'papaparse';
import { Document } from '@langchain/core/documents';

const DEFAULT_CHUNK_SIZE = 700;
const DEFAULT_CHUNK_OVERLAP = 100;
const DEFAULT_SEPARATORS = ['\n\n', '\n', ' ', ''];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB limit

const SUPPORTED_MIME_TYPES = {
	PDF: 'application/pdf',
	CSV: 'text/csv',
	TEXT: 'text/plain',
	MARKDOWN: 'text/markdown',
	HTML: 'text/html',
	DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

/**
 * Processes uploaded files into LangChain document chunks
 *
 * @param {File} file - The uploaded file object
 * @param {Buffer} fileBuffer - The file content as buffer
 * @param {Object} options - Processing configuration options
 * @returns {Promise<Array<Document>>} Array of LangChain Document objects where each contains:
 *   - pageContent: string (text chunk)
 *   - metadata: {source, type, size, chunk, totalChunks, chunkSize, processedAt, processingTime}
 */
export async function injestFile(file, fileBuffer, options = {}) {
	if (!file || !fileBuffer) {
		throw new Error('File and fileBuffer are required parameters');
	}

	if (fileBuffer.length > MAX_FILE_SIZE) {
		throw new Error(
			`File size (${fileBuffer.length} bytes) exceeds maximum limit of ${MAX_FILE_SIZE} bytes`
		);
	}

	console.log(`[FILE-INGESTION] Starting processing:`, {
		fileName: file.name,
		fileType: file.type,
		fileSize: `${(fileBuffer.length / 1024).toFixed(2)} KB`,
		chunkSize: options.maxChunkSize || DEFAULT_CHUNK_SIZE,
		overlap: options.overlap || DEFAULT_CHUNK_OVERLAP,
	});

	const textSplitter = new RecursiveCharacterTextSplitter({
		chunkSize: options.maxChunkSize || DEFAULT_CHUNK_SIZE,
		chunkOverlap: options.overlap || DEFAULT_CHUNK_OVERLAP,
		separators: options.separators || DEFAULT_SEPARATORS,
	});

	let content = '';
	const startTime = Date.now();

	try {
		content = await processFileByType(file, fileBuffer);

		if (!content || content.trim().length === 0) {
			throw new Error('No extractable text content found in the file');
		}

		console.log(
			`[FILE-INGESTION] Splitting content into chunks (${content.length} chars)`
		);
		const chunks = await textSplitter.splitText(content);

		// Create Document objects with metadata
		const documents = chunks.map(
			(chunk, index) =>
				new Document({
					pageContent: chunk,
					metadata: {
						source: file.name,
						type: file.type,
						size: fileBuffer.length,
						chunk: index,
						totalChunks: chunks.length,
						chunkSize: chunk.length,
						processedAt: new Date().toISOString(),
						processingTime: Date.now() - startTime,
					},
				})
		);

		console.log(`[FILE-INGESTION] Successfully processed file:`, {
			fileName: file.name,
			contentLength: content.length,
			chunksCreated: documents.length,
			processingTime: `${Date.now() - startTime}ms`,
		});

		return documents;
	} catch (error) {
		console.error(`[FILE-INGESTION] Error processing ${file.name}:`, {
			error: error.message,
			fileType: file.type,
			fileSize: fileBuffer.length,
		});
		throw new Error(`Failed to process file "${file.name}": ${error.message}`);
	}
}

/**
 * Routes file processing to the appropriate handler based on file type
 *
 * @param {File} file - The file object
 * @param {Buffer} fileBuffer - The file content buffer
 * @returns {Promise<string>} Extracted plain text content from the file
 */
async function processFileByType(file, fileBuffer) {
	const fileType = file.type.toLowerCase();
	const fileName = file.name.toLowerCase();

	if (fileType === SUPPORTED_MIME_TYPES.PDF) {
		return await processPDF(file, fileBuffer);
	} else if (
		fileType === SUPPORTED_MIME_TYPES.CSV ||
		fileName.endsWith('.csv')
	) {
		return await processCSV(fileBuffer);
	} else if (
		fileType === SUPPORTED_MIME_TYPES.TEXT ||
		fileType === SUPPORTED_MIME_TYPES.MARKDOWN ||
		fileName.endsWith('.txt') ||
		fileName.endsWith('.md')
	) {
		return processPlainText(fileBuffer);
	} else if (
		fileType === SUPPORTED_MIME_TYPES.HTML ||
		fileName.endsWith('.html')
	) {
		return processHTML(fileBuffer);
	} else {
		throw new Error(
			`Unsupported file type: ${fileType}. Supported types: PDF, CSV, TXT, MD, HTML`
		);
	}
}

/**
 * Processes PDF files using pdf2json library
 *
 * @param {File} file - The PDF file object
 * @param {Buffer} fileBuffer - The PDF file buffer
 * @returns {Promise<string>} Extracted text content from PDF
 */
async function processPDF(file, fileBuffer) {
	console.log(`[PDF-PROCESSOR] Processing PDF: ${file.name}`);

	// Suppress pdf2json console warnings
	const originalWarn = console.warn;
	console.warn = () => {};

	try {
		const PDFParser = (await import('pdf2json')).default;

		const pdfText = await new Promise((resolve, reject) => {
			const pdfParser = new PDFParser();

			pdfParser.on('pdfParser_dataError', (errData) => {
				console.error('[PDF-PROCESSOR] Parsing error:', errData.parserError);
				reject(new Error(`PDF parsing failed: ${errData.parserError}`));
			});

			pdfParser.on('pdfParser_dataReady', (pdfData) => {
				try {
					const textContent = extractTextFromPDFData(pdfData);
					resolve(textContent);
				} catch (extractError) {
					reject(
						new Error(`Failed to extract PDF text: ${extractError.message}`)
					);
				}
			});

			try {
				pdfParser.parseBuffer(fileBuffer);
			} catch (bufferError) {
				reject(new Error(`Failed to parse PDF buffer: ${bufferError.message}`));
			}
		});

		console.log(
			`[PDF-PROCESSOR] Successfully extracted ${pdfText.length} characters`
		);
		return pdfText;
	} finally {
		console.warn = originalWarn;
	}
}

/**
 * Extracts text content from parsed PDF data structure
 *
 * @param {Object} pdfData - Parsed PDF data from pdf2json
 * @returns {string} Clean text content extracted from PDF pages
 */
function extractTextFromPDFData(pdfData) {
	let textContent = '';

	if (!pdfData.Pages || !Array.isArray(pdfData.Pages)) {
		throw new Error('Invalid PDF data structure - no pages found');
	}

	pdfData.Pages.forEach((page, pageIndex) => {
		if (page.Texts && Array.isArray(page.Texts)) {
			page.Texts.forEach((text) => {
				if (text.R && Array.isArray(text.R)) {
					text.R.forEach((textRun) => {
						if (textRun.T) {
							try {
								textContent += decodeURIComponent(textRun.T) + ' ';
							} catch (decodeError) {
								textContent += textRun.T + ' ';
							}
						}
					});
				}
			});
		}
		textContent += '\n'; // Page break
	});

	const cleanedText = textContent.trim();
	if (cleanedText.length === 0) {
		throw new Error('No text content extracted from PDF');
	}

	return cleanedText;
}

/**
 * Processes CSV files using PapaParse library
 *
 * @param {Buffer} fileBuffer - The CSV file buffer
 * @returns {Promise<string>} Formatted text with "Row X: key: value, key: value" format
 */
async function processCSV(fileBuffer) {
	console.log('[CSV-PROCESSOR] Processing CSV file');

	const csvText = fileBuffer.toString('utf-8');
	const parseResult = Papa.parse(csvText, {
		header: true,
		skipEmptyLines: true,
		transformHeader: (header) => header.trim(),
	});

	if (parseResult.errors && parseResult.errors.length > 0) {
		console.warn('[CSV-PROCESSOR] Parse warnings:', parseResult.errors);
	}

	// Convert to readable format
	const formattedContent = parseResult.data
		.filter((row) =>
			Object.values(row).some((value) => value && value.toString().trim())
		)
		.map((row, index) => {
			const rowData = Object.entries(row)
				.filter(([key, value]) => value && value.toString().trim())
				.map(([key, value]) => `${key}: ${value}`)
				.join(', ');
			return `Row ${index + 1}: ${rowData}`;
		})
		.join('\n');

	console.log(`[CSV-PROCESSOR] Processed ${parseResult.data.length} rows`);
	return formattedContent;
}

/**
 * Processes plain text files (TXT, MD)
 *
 * @param {Buffer} fileBuffer - The text file buffer
 * @returns {string} Clean UTF-8 text content with normalized line endings
 */
function processPlainText(fileBuffer) {
	console.log('[TEXT-PROCESSOR] Processing plain text file');
	const content = fileBuffer.toString('utf-8');

	return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

/**
 * Processes HTML files by extracting text content
 *
 * @param {Buffer} fileBuffer - The HTML file buffer
 * @returns {string} Plain text content with HTML tags removed and whitespace normalized
 */
function processHTML(fileBuffer) {
	console.log('[HTML-PROCESSOR] Processing HTML file');
	const htmlContent = fileBuffer.toString('utf-8');

	// Strip HTML tags and normalize whitespace
	const textContent = htmlContent
		.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
		.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
		.replace(/<[^>]*>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

	if (textContent.length === 0) {
		throw new Error('No text content found in HTML file');
	}

	return textContent;
}
