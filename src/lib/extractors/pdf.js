import pdf from 'pdf-parse';
import { PerformanceMonitor } from '../performance.js';

/**
 * Extract text from PDF files with optimization for vector embeddings
 * 
 * @param {Buffer} buffer - PDF file buffer
 * @param {Object} options - Extraction options
 * @returns {Object} Extracted text data with metadata
 */
export async function extractFromPDF(buffer, options = {}) {
  const {
    maxPages = 100,
    preserveFormatting = false,
    extractMetadata = true,
  } = options;

  try {
    PerformanceMonitor.startTimer('pdf-extraction');

    const pdfOptions = {
      max: maxPages,
      version: 'v1.10.100',
    };

    const data = await pdf(buffer, pdfOptions);
    
    let extractedText = data.text;
    
    // Clean and optimize text for embeddings
    if (!preserveFormatting) {
      extractedText = cleanPDFText(extractedText);
    }

    // Extract structured content
    const pages = extractPages(data.text);
    const metadata = extractMetadata ? extractPDFMetadata(data) : {};

    const result = {
      text: extractedText,
      pages: pages,
      metadata: {
        ...metadata,
        totalPages: data.numpages,
        fileType: 'pdf',
        extractedAt: new Date().toISOString(),
      },
      wordCount: countWords(extractedText),
      characterCount: extractedText.length,
    };

    PerformanceMonitor.endTimer('pdf-extraction');
    return result;

  } catch (error) {
    PerformanceMonitor.endTimer('pdf-extraction', 'error');
    console.error('PDF extraction error:', error);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

/**
 * Clean PDF text for better vector embedding quality
 */
function cleanPDFText(text) {
  return text
    // Remove excessive whitespace and normalize line breaks
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    
    // Remove page headers/footers (common patterns)
    .replace(/Page \d+( of \d+)?/gi, '')
    .replace(/^\d+\s*$/gm, '') // Page numbers on separate lines
    
    // Clean up hyphenated words across line breaks
    .replace(/(\w)-\n(\w)/g, '$1$2')
    
    // Remove form field artifacts
    .replace(/\[.*?\]/g, '')
    .replace(/_{3,}/g, '')
    
    // Normalize spacing around punctuation
    .replace(/\s+([.!?])/g, '$1')
    .replace(/([.!?])\s+/g, '$1 ')
    
    // Remove leading/trailing whitespace from lines
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n')
    
    .trim();
}

/**
 * Extract individual pages for better chunking
 */
function extractPages(text) {
  // Split by common page break patterns
  const pageBreakPatterns = [
    /\n\s*Page \d+\s*\n/gi,
    /\f/g, // Form feed character
    /\n\s*\d+\s*\n/g, // Page numbers
  ];

  let pages = [text];
  
  for (const pattern of pageBreakPatterns) {
    const newPages = [];
    for (const page of pages) {
      newPages.push(...page.split(pattern));
    }
    pages = newPages;
  }

  return pages
    .map((page, index) => ({
      pageNumber: index + 1,
      content: page.trim(),
      wordCount: countWords(page),
    }))
    .filter(page => page.content.length > 0);
}

/**
 * Extract PDF metadata for better context
 */
function extractPDFMetadata(data) {
  const metadata = {};
  
  if (data.info) {
    metadata.title = data.info.Title || '';
    metadata.author = data.info.Author || '';
    metadata.subject = data.info.Subject || '';
    metadata.creator = data.info.Creator || '';
    metadata.producer = data.info.Producer || '';
    metadata.creationDate = data.info.CreationDate || '';
    metadata.modificationDate = data.info.ModDate || '';
  }
  
  return metadata;
}

/**
 * Count words in text
 */
function countWords(text) {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Chunk PDF text for vector embeddings
 * 
 * @param {string} text - Extracted text
 * @param {Object} options - Chunking options
 * @returns {Array} Text chunks optimized for embeddings
 */
export function chunkPDFText(text, options = {}) {
  const {
    maxChunkSize = 700,
    overlap = 100,
    preserveParagraphs = true,
  } = options;

  if (!text || text.length === 0) {
    return [];
  }

  const chunks = [];
  const paragraphs = text.split(/\n\s*\n/);
  
  let currentChunk = '';
  let currentTokens = 0;
  
  for (const paragraph of paragraphs) {
    const paragraphTokens = estimateTokens(paragraph);
    
    // If paragraph is too long, split it
    if (paragraphTokens > maxChunkSize) {
      if (currentChunk) {
        chunks.push({
          content: currentChunk.trim(),
          tokens: currentTokens,
          type: 'paragraph_boundary',
        });
        currentChunk = '';
        currentTokens = 0;
      }
      
      // Split long paragraph into sentences
      const sentences = paragraph.split(/[.!?]+\s+/);
      let sentenceChunk = '';
      let sentenceTokens = 0;
      
      for (const sentence of sentences) {
        const sentTokens = estimateTokens(sentence);
        
        if (sentenceTokens + sentTokens > maxChunkSize && sentenceChunk) {
          chunks.push({
            content: sentenceChunk.trim(),
            tokens: sentenceTokens,
            type: 'sentence_boundary',
          });
          sentenceChunk = sentence;
          sentenceTokens = sentTokens;
        } else {
          sentenceChunk += (sentenceChunk ? '. ' : '') + sentence;
          sentenceTokens += sentTokens;
        }
      }
      
      if (sentenceChunk) {
        chunks.push({
          content: sentenceChunk.trim(),
          tokens: sentenceTokens,
          type: 'sentence_boundary',
        });
      }
      
    } else if (currentTokens + paragraphTokens > maxChunkSize) {
      // Current chunk is full, save it and start new one
      if (currentChunk) {
        chunks.push({
          content: currentChunk.trim(),
          tokens: currentTokens,
          type: 'paragraph_boundary',
        });
      }
      
      currentChunk = paragraph;
      currentTokens = paragraphTokens;
      
    } else {
      // Add paragraph to current chunk
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      currentTokens += paragraphTokens;
    }
  }
  
  // Add final chunk
  if (currentChunk) {
    chunks.push({
      content: currentChunk.trim(),
      tokens: currentTokens,
      type: 'final_chunk',
    });
  }
  
  // Add overlap between chunks
  return addOverlapToChunks(chunks, overlap);
}

/**
 * Estimate token count (rough approximation)
 */
function estimateTokens(text) {
  // Rough estimation: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}

/**
 * Add overlap between chunks for better context preservation
 */
function addOverlapToChunks(chunks, overlapTokens) {
  if (chunks.length <= 1 || overlapTokens <= 0) {
    return chunks;
  }
  
  const overlappedChunks = [chunks[0]];
  
  for (let i = 1; i < chunks.length; i++) {
    const currentChunk = chunks[i];
    const previousChunk = chunks[i - 1];
    
    // Get overlap text from previous chunk
    const previousWords = previousChunk.content.split(/\s+/);
    const overlapWordCount = Math.min(
      Math.floor(overlapTokens / 4), 
      Math.floor(previousWords.length / 2)
    );
    
    if (overlapWordCount > 0) {
      const overlapText = previousWords
        .slice(-overlapWordCount)
        .join(' ');
      
      overlappedChunks.push({
        ...currentChunk,
        content: overlapText + ' ' + currentChunk.content,
        tokens: currentChunk.tokens + estimateTokens(overlapText),
        hasOverlap: true,
      });
    } else {
      overlappedChunks.push(currentChunk);
    }
  }
  
  return overlappedChunks.map((chunk, index) => ({
    ...chunk,
    chunkIndex: index,
  }));
}
