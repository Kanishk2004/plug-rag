import * as cheerio from 'cheerio';
import { JSDOM } from 'jsdom';
import { PerformanceMonitor } from '../performance.js';

/**
 * Extract text from HTML content or web URLs with optimization for vector embeddings
 * 
 * @param {Buffer|string} input - HTML buffer, HTML string, or URL
 * @param {Object} options - Extraction options
 * @returns {Object} Extracted text data with metadata
 */
export async function extractFromHTML(input, options = {}) {
  const {
    isURL = false,
    includeMetadata = true,
    preserveStructure = true,
    extractLinks = false,
    maxContentLength = 1000000, // 1MB limit
    timeout = 30000, // 30 second timeout for URLs
  } = options;

  try {
    PerformanceMonitor.startTimer('html-extraction');

    let htmlContent;
    let metadata = {
      fileType: 'html',
      extractedAt: new Date().toISOString(),
    };

    if (isURL) {
      // Fetch content from URL
      const fetchResult = await fetchWebContent(input, timeout);
      htmlContent = fetchResult.content;
      metadata = { ...metadata, ...fetchResult.metadata };
    } else {
      // Process HTML buffer or string
      htmlContent = Buffer.isBuffer(input) ? input.toString('utf8') : input;
    }

    // Truncate if too large
    if (htmlContent.length > maxContentLength) {
      htmlContent = htmlContent.substring(0, maxContentLength);
      metadata.truncated = true;
    }

    // Parse HTML with Cheerio for better performance
    const $ = cheerio.load(htmlContent);
    
    // Extract structured content
    const extractedData = extractStructuredHTML($, {
      includeMetadata,
      preserveStructure,
      extractLinks,
    });

    // Clean and optimize text for embeddings
    const cleanedText = cleanHTMLText(extractedData.text);

    const result = {
      text: cleanedText,
      structure: extractedData.structure,
      links: extractedData.links,
      metadata: {
        ...metadata,
        ...extractedData.metadata,
      },
      wordCount: countWords(cleanedText),
      characterCount: cleanedText.length,
    };

    PerformanceMonitor.endTimer('html-extraction');
    return result;

  } catch (error) {
    PerformanceMonitor.endTimer('html-extraction', 'error');
    console.error('HTML extraction error:', error);
    throw new Error(`Failed to extract text from HTML: ${error.message}`);
  }
}

/**
 * Fetch content from web URL
 */
async function fetchWebContent(url, timeout) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PlugRAG-Bot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const content = await response.text();
    
    return {
      content,
      metadata: {
        url: url,
        statusCode: response.status,
        contentType: response.headers.get('content-type'),
        lastModified: response.headers.get('last-modified'),
        contentLength: response.headers.get('content-length'),
        fetchedAt: new Date().toISOString(),
      },
    };

  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    
    throw error;
  }
}

/**
 * Extract structured content from HTML using Cheerio
 */
function extractStructuredHTML($, options) {
  const { includeMetadata, preserveStructure, extractLinks } = options;

  // Remove unwanted elements
  $('script, style, nav, footer, aside, .ads, .advertisement, .popup, .modal').remove();
  $('[class*="ad-"], [id*="ad-"], [class*="advertisement"]').remove();
  $('iframe, embed, object').remove();

  // Extract metadata
  const metadata = includeMetadata ? extractHTMLMetadata($) : {};

  // Extract main content
  const mainContent = extractMainContent($);
  
  // Extract structured elements
  const structure = preserveStructure ? extractHTMLStructure($) : {};
  
  // Extract links
  const links = extractLinks ? extractHTMLLinks($) : [];

  // Combine all text content
  const allText = [
    metadata.title || '',
    metadata.description || '',
    mainContent,
  ].filter(text => text.trim().length > 0).join('\n\n');

  return {
    text: allText,
    structure,
    links,
    metadata,
  };
}

/**
 * Extract HTML metadata
 */
function extractHTMLMetadata($) {
  const metadata = {};

  // Basic metadata
  metadata.title = $('title').text().trim();
  metadata.description = $('meta[name="description"]').attr('content') || 
                         $('meta[property="og:description"]').attr('content') || '';
  
  metadata.keywords = $('meta[name="keywords"]').attr('content') || '';
  metadata.author = $('meta[name="author"]').attr('content') || '';
  metadata.language = $('html').attr('lang') || $('meta[http-equiv="content-language"]').attr('content') || 'en';

  // Open Graph metadata
  metadata.ogTitle = $('meta[property="og:title"]').attr('content') || '';
  metadata.ogType = $('meta[property="og:type"]').attr('content') || '';
  metadata.ogUrl = $('meta[property="og:url"]').attr('content') || '';
  metadata.ogImage = $('meta[property="og:image"]').attr('content') || '';

  // Twitter Card metadata
  metadata.twitterCard = $('meta[name="twitter:card"]').attr('content') || '';
  metadata.twitterTitle = $('meta[name="twitter:title"]').attr('content') || '';
  metadata.twitterDescription = $('meta[name="twitter:description"]').attr('content') || '';

  // Article metadata
  metadata.publishedTime = $('meta[property="article:published_time"]').attr('content') || 
                          $('time[datetime]').attr('datetime') || '';
  metadata.modifiedTime = $('meta[property="article:modified_time"]').attr('content') || '';
  metadata.section = $('meta[property="article:section"]').attr('content') || '';
  metadata.tags = $('meta[property="article:tag"]').map((i, el) => $(el).attr('content')).get();

  return metadata;
}

/**
 * Extract main content using content detection heuristics
 */
function extractMainContent($) {
  // Try common content selectors first
  const contentSelectors = [
    'main',
    'article',
    '[role="main"]',
    '.main-content',
    '.content',
    '.post-content',
    '.article-content',
    '.entry-content',
    '#content',
    '#main',
  ];

  for (const selector of contentSelectors) {
    const element = $(selector);
    if (element.length > 0 && element.text().trim().length > 100) {
      return extractTextFromElement(element);
    }
  }

  // Fallback: find the largest text block
  const bodyContent = $('body');
  if (bodyContent.length > 0) {
    return extractTextFromElement(bodyContent);
  }

  // Last resort: get all text
  return $.root().text();
}

/**
 * Extract text from a Cheerio element
 */
function extractTextFromElement(element) {
  // Clone to avoid modifying original
  const $el = element.clone();
  
  // Remove unwanted nested elements
  $el.find('script, style, nav, footer, aside').remove();
  $el.find('.ads, .advertisement, .social-share, .comments').remove();
  
  // Get text with some structure preservation
  let text = '';
  
  $el.contents().each((i, node) => {
    if (node.type === 'text') {
      const nodeText = $(node).text().trim();
      if (nodeText) {
        text += nodeText + ' ';
      }
    } else if (node.type === 'tag') {
      const tagName = node.tagName.toLowerCase();
      const nodeText = $(node).text().trim();
      
      if (nodeText) {
        // Add line breaks for block elements
        if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'br'].includes(tagName)) {
          text += nodeText + '\n';
        } else {
          text += nodeText + ' ';
        }
      }
    }
  });
  
  return text.trim();
}

/**
 * Extract HTML structure for better chunking
 */
function extractHTMLStructure($) {
  const structure = {
    headings: [],
    paragraphs: [],
    lists: [],
    tables: [],
    images: [],
  };

  // Extract headings with hierarchy
  $('h1, h2, h3, h4, h5, h6').each((i, elem) => {
    const level = parseInt(elem.tagName.charAt(1));
    const text = $(elem).text().trim();
    if (text) {
      structure.headings.push({
        level,
        text,
        id: $(elem).attr('id') || '',
        class: $(elem).attr('class') || '',
      });
    }
  });

  // Extract meaningful paragraphs
  $('p').each((i, elem) => {
    const text = $(elem).text().trim();
    if (text && text.length > 20) { // Filter out very short paragraphs
      structure.paragraphs.push({
        text,
        class: $(elem).attr('class') || '',
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
      structure.lists.push({
        type: elem.tagName.toLowerCase(),
        items,
        class: $(elem).attr('class') || '',
      });
    }
  });

  // Extract tables
  $('table').each((i, elem) => {
    const rows = [];
    $(elem).find('tr').each((j, tr) => {
      const cells = [];
      $(tr).find('td, th').each((k, cell) => {
        const text = $(cell).text().trim();
        cells.push({
          text,
          isHeader: cell.tagName.toLowerCase() === 'th',
        });
      });
      if (cells.some(cell => cell.text.length > 0)) {
        rows.push(cells);
      }
    });
    
    if (rows.length > 0) {
      structure.tables.push({
        rows,
        class: $(elem).attr('class') || '',
      });
    }
  });

  // Extract images with alt text
  $('img').each((i, elem) => {
    const alt = $(elem).attr('alt') || '';
    const src = $(elem).attr('src') || '';
    const title = $(elem).attr('title') || '';
    
    if (alt || title) {
      structure.images.push({
        alt,
        title,
        src,
      });
    }
  });

  return structure;
}

/**
 * Extract links from HTML
 */
function extractHTMLLinks($) {
  const links = [];
  
  $('a[href]').each((i, elem) => {
    const href = $(elem).attr('href');
    const text = $(elem).text().trim();
    const title = $(elem).attr('title') || '';
    
    if (href && text) {
      links.push({
        url: href,
        text,
        title,
        isExternal: href.startsWith('http') && !href.includes(window?.location?.hostname),
      });
    }
  });
  
  return links;
}

/**
 * Clean HTML text for better vector embedding quality
 */
function cleanHTMLText(text) {
  return text
    // Normalize whitespace
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    
    // Remove HTML entities (basic ones)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-zA-Z0-9#]+;/g, '') // Remove other entities
    
    // Clean up navigation and UI text
    .replace(/\b(Home|About|Contact|Menu|Search|Login|Sign up|Privacy|Terms)\b/gi, '')
    .replace(/\b(Click here|Read more|Learn more|See more|Show more)\b/gi, '')
    
    // Remove social media artifacts
    .replace(/\b(Share|Tweet|Like|Follow|Subscribe)\b/gi, '')
    .replace(/\b\d+\s+(likes?|shares?|comments?|views?)\b/gi, '')
    
    // Clean up spacing around punctuation
    .replace(/\s+([.!?,:;])/g, '$1')
    .replace(/([.!?])\s+/g, '$1 ')
    
    // Remove lines with only whitespace and filter out empty lines
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n')
    
    .trim();
}

/**
 * Count words in text
 */
function countWords(text) {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Chunk HTML text for vector embeddings with structure awareness
 * 
 * @param {string} text - Extracted text
 * @param {Object} structure - HTML structure
 * @param {Object} options - Chunking options
 * @returns {Array} Text chunks optimized for embeddings
 */
export function chunkHTMLText(text, structure = {}, options = {}) {
  const {
    maxChunkSize = 700,
    overlap = 100,
    respectStructure = true,
    includeHeadings = true,
  } = options;

  if (!text || text.length === 0) {
    return [];
  }

  const chunks = [];
  
  if (respectStructure && structure.headings?.length > 0) {
    // Structure-aware chunking using headings
    chunks.push(...createStructuredHTMLChunks(text, structure, maxChunkSize, includeHeadings));
  } else {
    // Fallback to paragraph-based chunking
    chunks.push(...createParagraphChunks(text, maxChunkSize));
  }
  
  // Add overlap between chunks
  return addOverlapToChunks(chunks, overlap);
}

/**
 * Create chunks based on HTML structure
 */
function createStructuredHTMLChunks(text, structure, maxChunkSize, includeHeadings) {
  const chunks = [];
  const lines = text.split('\n');
  const headings = structure.headings || [];
  
  let currentChunk = '';
  let currentTokens = 0;
  let currentHeading = '';
  let currentLevel = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) continue;
    
    // Check if this line is a heading
    const heading = headings.find(h => h.text === line);
    const isHeading = !!heading;
    const lineTokens = estimateTokens(line);
    
    if (isHeading) {
      const headingLevel = heading.level;
      
      // If we have content and this is a major heading break, save current chunk
      if (currentChunk && (headingLevel <= currentLevel || currentTokens > maxChunkSize * 0.8)) {
        chunks.push({
          content: currentChunk.trim(),
          tokens: currentTokens,
          type: 'structured_section',
          heading: currentHeading,
          level: currentLevel,
        });
        
        currentChunk = includeHeadings ? line : '';
        currentTokens = includeHeadings ? lineTokens : 0;
        currentHeading = line;
        currentLevel = headingLevel;
      } else {
        // Add heading to current chunk
        currentChunk += (currentChunk ? '\n' : '') + (includeHeadings ? line : '');
        currentTokens += includeHeadings ? lineTokens : 0;
        
        if (!currentHeading) {
          currentHeading = line;
          currentLevel = headingLevel;
        }
      }
      
    } else if (currentTokens + lineTokens > maxChunkSize && currentChunk) {
      // Current chunk is full
      chunks.push({
        content: currentChunk.trim(),
        tokens: currentTokens,
        type: 'structured_section',
        heading: currentHeading,
        level: currentLevel,
      });
      
      currentChunk = line;
      currentTokens = lineTokens;
      
    } else {
      // Add line to current chunk
      currentChunk += (currentChunk ? '\n' : '') + line;
      currentTokens += lineTokens;
    }
  }
  
  // Add final chunk
  if (currentChunk) {
    chunks.push({
      content: currentChunk.trim(),
      tokens: currentTokens,
      type: 'structured_section',
      heading: currentHeading,
      level: currentLevel,
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
      // Save current chunk if exists
      if (currentChunk) {
        chunks.push({
          content: currentChunk.trim(),
          tokens: currentTokens,
          type: 'paragraph_boundary',
        });
        currentChunk = '';
        currentTokens = 0;
      }
      
      // Split long paragraph by sentences
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
 * Estimate token count
 */
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

/**
 * Add overlap between chunks
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
