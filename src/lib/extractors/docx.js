import mammoth from 'mammoth';
import { PerformanceMonitor } from '../performance.js';

/**
 * Extract text from DOCX files with optimization for vector embeddings
 * 
 * @param {Buffer} buffer - DOCX file buffer
 * @param {Object} options - Extraction options
 * @returns {Object} Extracted text data with metadata
 */
export async function extractFromDOCX(buffer, options = {}) {
  const {
    preserveFormatting = false,
    extractImages = false,
    includeHeaders = true,
    includeFooters = false,
  } = options;

  try {
    PerformanceMonitor.startTimer('docx-extraction');

    const mammothOptions = {
      convertImage: extractImages ? mammoth.images.imgElement(function(image) {
        return image.read("base64").then(function(imageBuffer) {
          return {
            src: "data:" + image.contentType + ";base64," + imageBuffer
          };
        });
      }) : mammoth.images.ignore,
      
      includeDefaultStyleMap: preserveFormatting,
      includeEmbeddedStyleMap: preserveFormatting,
    };

    const result = await mammoth.extractRawText(buffer, mammothOptions);
    
    let extractedText = result.value;
    
    // Clean and optimize text for embeddings
    if (!preserveFormatting) {
      extractedText = cleanDOCXText(extractedText);
    }

    // Extract structured content
    const htmlResult = await mammoth.convertToHtml(buffer, mammothOptions);
    const structuredContent = extractStructuredContent(htmlResult.value);

    const finalResult = {
      text: extractedText,
      structuredContent: structuredContent,
      metadata: {
        fileType: 'docx',
        extractedAt: new Date().toISOString(),
        warnings: result.messages || [],
      },
      wordCount: countWords(extractedText),
      characterCount: extractedText.length,
    };

    PerformanceMonitor.endTimer('docx-extraction');
    return finalResult;

  } catch (error) {
    PerformanceMonitor.endTimer('docx-extraction', 'error');
    console.error('DOCX extraction error:', error);
    throw new Error(`Failed to extract text from DOCX: ${error.message}`);
  }
}

/**
 * Clean DOCX text for better vector embedding quality
 */
function cleanDOCXText(text) {
  return text
    // Normalize line breaks and whitespace
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    
    // Remove document artifacts
    .replace(/\[.*?\]/g, '') // Remove bracketed content
    .replace(/_{3,}/g, '') // Remove underlines
    .replace(/\.{3,}/g, '...') // Normalize ellipsis
    
    // Clean up table artifacts
    .replace(/\|\s*\|/g, '') // Empty table cells
    .replace(/\s*\|\s*/g, ' | ') // Normalize table separators
    
    // Remove excessive spacing around punctuation
    .replace(/\s+([.!?,:;])/g, '$1')
    .replace(/([.!?])\s+/g, '$1 ')
    
    // Clean up lists and bullets
    .replace(/^[\s]*[•·▪▫◦‣⁃]\s*/gm, '• ')
    .replace(/^[\s]*\d+\.\s*/gm, (match, offset, string) => {
      const lineStart = string.lastIndexOf('\n', offset) + 1;
      const lineContent = string.substring(lineStart, offset);
      return lineContent.trim() === '' ? '1. ' : match;
    })
    
    // Remove leading/trailing whitespace from lines
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n')
    
    .trim();
}

/**
 * Extract structured content from HTML for better context
 */
function extractStructuredContent(html) {
  const cheerio = require('cheerio');
  const $ = cheerio.load(html);
  
  const structured = {
    headings: [],
    paragraphs: [],
    lists: [],
    tables: [],
  };

  // Extract headings with hierarchy
  $('h1, h2, h3, h4, h5, h6').each((i, elem) => {
    const level = parseInt(elem.tagName.charAt(1));
    const text = $(elem).text().trim();
    if (text) {
      structured.headings.push({
        level: level,
        text: text,
        index: i,
      });
    }
  });

  // Extract paragraphs
  $('p').each((i, elem) => {
    const text = $(elem).text().trim();
    if (text && text.length > 10) { // Filter out very short paragraphs
      structured.paragraphs.push({
        text: text,
        index: i,
      });
    }
  });

  // Extract lists
  $('ul, ol').each((i, elem) => {
    const items = [];
    $(elem).find('li').each((j, li) => {
      const text = $(li).text().trim();
      if (text) {
        items.push(text);
      }
    });
    
    if (items.length > 0) {
      structured.lists.push({
        type: elem.tagName,
        items: items,
        index: i,
      });
    }
  });

  // Extract tables
  $('table').each((i, elem) => {
    const rows = [];
    $(elem).find('tr').each((j, tr) => {
      const cells = [];
      $(tr).find('td, th').each((k, cell) => {
        cells.push($(cell).text().trim());
      });
      if (cells.some(cell => cell.length > 0)) {
        rows.push(cells);
      }
    });
    
    if (rows.length > 0) {
      structured.tables.push({
        rows: rows,
        index: i,
      });
    }
  });

  return structured;
}

/**
 * Count words in text
 */
function countWords(text) {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Chunk DOCX text for vector embeddings with structure awareness
 * 
 * @param {string} text - Extracted text
 * @param {Object} structuredContent - Structured content from DOCX
 * @param {Object} options - Chunking options
 * @returns {Array} Text chunks optimized for embeddings
 */
export function chunkDOCXText(text, structuredContent = {}, options = {}) {
  const {
    maxChunkSize = 700,
    overlap = 100,
    respectStructure = true,
  } = options;

  if (!text || text.length === 0) {
    return [];
  }

  const chunks = [];
  
  if (respectStructure && structuredContent.headings?.length > 0) {
    // Structure-aware chunking using headings
    chunks.push(...createStructuredChunks(text, structuredContent, maxChunkSize));
  } else {
    // Fallback to paragraph-based chunking
    chunks.push(...createParagraphChunks(text, maxChunkSize));
  }
  
  // Add overlap between chunks
  return addOverlapToChunks(chunks, overlap);
}

/**
 * Create chunks based on document structure (headings)
 */
function createStructuredChunks(text, structuredContent, maxChunkSize) {
  const chunks = [];
  const lines = text.split('\n');
  const headings = structuredContent.headings || [];
  
  let currentChunk = '';
  let currentTokens = 0;
  let currentHeading = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) continue;
    
    // Check if this line is a heading
    const isHeading = headings.some(h => h.text === line);
    const lineTokens = estimateTokens(line);
    
    if (isHeading && currentChunk) {
      // Save current chunk before starting new section
      chunks.push({
        content: currentChunk.trim(),
        tokens: currentTokens,
        type: 'structured_section',
        heading: currentHeading,
      });
      
      currentChunk = line;
      currentTokens = lineTokens;
      currentHeading = line;
      
    } else if (currentTokens + lineTokens > maxChunkSize && currentChunk) {
      // Current chunk is full
      chunks.push({
        content: currentChunk.trim(),
        tokens: currentTokens,
        type: 'structured_section',
        heading: currentHeading,
      });
      
      currentChunk = line;
      currentTokens = lineTokens;
      
    } else {
      // Add line to current chunk
      currentChunk += (currentChunk ? '\n' : '') + line;
      currentTokens += lineTokens;
      
      if (isHeading && !currentHeading) {
        currentHeading = line;
      }
    }
  }
  
  // Add final chunk
  if (currentChunk) {
    chunks.push({
      content: currentChunk.trim(),
      tokens: currentTokens,
      type: 'structured_section',
      heading: currentHeading,
    });
  }
  
  return chunks;
}

/**
 * Create chunks based on paragraphs
 */
function createParagraphChunks(text, maxChunkSize) {
  const chunks = [];
  const paragraphs = text.split(/\n\s*\n/);
  
  let currentChunk = '';
  let currentTokens = 0;
  
  for (const paragraph of paragraphs) {
    const paragraphTokens = estimateTokens(paragraph);
    
    if (paragraphTokens > maxChunkSize) {
      // Split long paragraph
      if (currentChunk) {
        chunks.push({
          content: currentChunk.trim(),
          tokens: currentTokens,
          type: 'paragraph_boundary',
        });
        currentChunk = '';
        currentTokens = 0;
      }
      
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
      chunks.push({
        content: currentChunk.trim(),
        tokens: currentTokens,
        type: 'paragraph_boundary',
      });
      
      currentChunk = paragraph;
      currentTokens = paragraphTokens;
      
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      currentTokens += paragraphTokens;
    }
  }
  
  if (currentChunk) {
    chunks.push({
      content: currentChunk.trim(),
      tokens: currentTokens,
      type: 'paragraph_boundary',
    });
  }
  
  return chunks;
}

/**
 * Estimate token count (rough approximation)
 */
function estimateTokens(text) {
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
