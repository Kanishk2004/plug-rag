/**
 * Input Validation Processor
 * 
 * Handles validation of inputs across the application including
 * files, text content, API keys, bot configurations, and user data.
 */

import { logInfo, logError } from '../utils/logger.js';

/**
 * File validation rules
 */
const FILE_VALIDATION = {
  maxSize: 50 * 1024 * 1024, // 50MB
  allowedMimeTypes: [
    'application/pdf',
    'text/csv',
    'text/plain',
    'text/markdown',
    'text/html',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ],
  maxFileNameLength: 255
};

/**
 * Text validation rules
 */
const TEXT_VALIDATION = {
  minLength: 10,
  maxLength: 1000000, // 1MB of text
  minWords: 3,
  maxWords: 100000
};

/**
 * Bot validation rules
 */
const BOT_VALIDATION = {
  nameMinLength: 3,
  nameMaxLength: 50,
  descriptionMaxLength: 500,
  allowedModels: [
    'gpt-3.5-turbo',
    'gpt-4',
    'gpt-4-turbo',
    'text-embedding-3-small',
    'text-embedding-3-large'
  ]
};

/**
 * Validate uploaded file
 * @param {File} file - File object
 * @param {Buffer} fileBuffer - File content buffer
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
export function validateFile(file, fileBuffer, options = {}) {
  const errors = [];
  const warnings = [];

  try {
    logInfo('Validating file', { 
      fileName: file.name, 
      fileType: file.type,
      fileSize: fileBuffer?.length || 'unknown'
    });

    // Basic file object validation
    if (!file) {
      errors.push('File object is required');
      return { isValid: false, errors, warnings };
    }

    if (!file.name || file.name.trim().length === 0) {
      errors.push('File name is required');
    }

    if (file.name.length > FILE_VALIDATION.maxFileNameLength) {
      errors.push(`File name is too long (max ${FILE_VALIDATION.maxFileNameLength} characters)`);
    }

    // File buffer validation
    if (!fileBuffer) {
      errors.push('File content is required');
      return { isValid: false, errors, warnings };
    }

    // File size validation
    const fileSizeInMB = fileBuffer.length / (1024 * 1024);
    const maxSizeInMB = FILE_VALIDATION.maxSize / (1024 * 1024);
    
    if (fileBuffer.length > FILE_VALIDATION.maxSize) {
      errors.push(`File size (${fileSizeInMB.toFixed(2)}MB) exceeds maximum limit of ${maxSizeInMB}MB`);
    }

    if (fileBuffer.length === 0) {
      errors.push('File is empty');
    }

    // MIME type validation
    if (!file.type) {
      warnings.push('File type not detected, will attempt to process as text');
    } else if (!FILE_VALIDATION.allowedMimeTypes.includes(file.type)) {
      warnings.push(`File type ${file.type} is not officially supported, will attempt to process as text`);
    }

    // File extension validation
    const fileExtension = file.name.toLowerCase().split('.').pop();
    const suspiciousExtensions = ['exe', 'bat', 'sh', 'cmd', 'com', 'scr', 'vbs', 'js'];
    
    if (suspiciousExtensions.includes(fileExtension)) {
      errors.push(`File extension .${fileExtension} is not allowed for security reasons`);
    }

    // Content validation for text files only (not binary formats like PDF/DOCX)
    if (file.type?.startsWith('text/')) {
      const contentValidation = validateTextContent(fileBuffer.toString('utf-8'));
      if (!contentValidation.isValid) {
        warnings.push(...contentValidation.warnings);
        if (contentValidation.errors.length > 0) {
          errors.push(...contentValidation.errors);
        }
      }
    }

    const isValid = errors.length === 0;

    logInfo('File validation completed', {
      fileName: file.name,
      isValid,
      errorsCount: errors.length,
      warningsCount: warnings.length
    });

    return {
      isValid,
      errors,
      warnings,
      fileInfo: {
        name: file.name,
        type: file.type,
        size: fileBuffer.length,
        sizeInMB: fileSizeInMB
      }
    };
  } catch (error) {
    logError('File validation failed', { error: error.message });
    return {
      isValid: false,
      errors: [`Validation error: ${error.message}`],
      warnings
    };
  }
}

/**
 * Validate text content
 * @param {string} text - Text to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
export function validateTextContent(text, options = {}) {
  const errors = [];
  const warnings = [];

  const {
    minLength = TEXT_VALIDATION.minLength,
    maxLength = TEXT_VALIDATION.maxLength,
    minWords = TEXT_VALIDATION.minWords,
    maxWords = TEXT_VALIDATION.maxWords
  } = options;

  try {
    if (!text || typeof text !== 'string') {
      errors.push('Text content must be a non-empty string');
      return { isValid: false, errors, warnings };
    }

    const trimmedText = text.trim();

    // Length validation
    if (trimmedText.length < minLength) {
      errors.push(`Text is too short (${trimmedText.length} characters, minimum ${minLength})`);
    }

    if (trimmedText.length > maxLength) {
      errors.push(`Text is too long (${trimmedText.length} characters, maximum ${maxLength})`);
    }

    // Word count validation
    const words = trimmedText.split(/\s+/).filter(word => word.length > 0);
    
    if (words.length < minWords) {
      errors.push(`Text has too few words (${words.length}, minimum ${minWords})`);
    }

    if (words.length > maxWords) {
      errors.push(`Text has too many words (${words.length}, maximum ${maxWords})`);
    }

    // Content quality checks
    const uniqueWords = new Set(words.map(word => word.toLowerCase()));
    const uniqueWordRatio = uniqueWords.size / words.length;
    
    if (uniqueWordRatio < 0.1 && words.length > 50) {
      warnings.push('Text appears to be very repetitive');
    }

    // Check for potential encoding issues
    const hasSpecialChars = /[^\x00-\x7F]/.test(text);
    if (hasSpecialChars) {
      warnings.push('Text contains non-ASCII characters - ensure proper encoding');
    }

    // Check for potential binary content
    const binaryCharCount = (text.match(/[\x00-\x08\x0E-\x1F\x7F]/g) || []).length;
    if (binaryCharCount > text.length * 0.1) {
      errors.push('Text appears to contain binary data');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      textStats: {
        length: trimmedText.length,
        wordCount: words.length,
        uniqueWords: uniqueWords.size,
        uniqueWordRatio: uniqueWordRatio,
        hasSpecialChars
      }
    };
  } catch (error) {
    logError('Text validation failed', { error: error.message });
    return {
      isValid: false,
      errors: [`Validation error: ${error.message}`],
      warnings
    };
  }
}

/**
 * Validate bot configuration
 * @param {Object} botData - Bot data to validate
 * @returns {Object} Validation result
 */
export function validateBotConfig(botData) {
  const errors = [];
  const warnings = [];

  try {
    if (!botData || typeof botData !== 'object') {
      errors.push('Bot data must be a valid object');
      return { isValid: false, errors, warnings };
    }

    // Name validation
    if (!botData.name || typeof botData.name !== 'string') {
      errors.push('Bot name is required and must be a string');
    } else {
      const trimmedName = botData.name.trim();
      if (trimmedName.length < BOT_VALIDATION.nameMinLength) {
        errors.push(`Bot name must be at least ${BOT_VALIDATION.nameMinLength} characters`);
      }
      if (trimmedName.length > BOT_VALIDATION.nameMaxLength) {
        errors.push(`Bot name must not exceed ${BOT_VALIDATION.nameMaxLength} characters`);
      }
    }

    // Description validation
    if (botData.description && botData.description.length > BOT_VALIDATION.descriptionMaxLength) {
      errors.push(`Bot description must not exceed ${BOT_VALIDATION.descriptionMaxLength} characters`);
    }

    // Model validation
    if (botData.model && !BOT_VALIDATION.allowedModels.includes(botData.model)) {
      warnings.push(`Model ${botData.model} is not in the list of recommended models`);
    }

    // API key validation (if provided)
    if (botData.openaiApiKey) {
      const keyValidation = validateApiKey(botData.openaiApiKey);
      if (!keyValidation.isValid) {
        errors.push(...keyValidation.errors);
      }
    }

    // Status validation
    if (botData.status && !['active', 'inactive'].includes(botData.status)) {
      errors.push('Bot status must be either "active" or "inactive"');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  } catch (error) {
    logError('Bot config validation failed', { error: error.message });
    return {
      isValid: false,
      errors: [`Validation error: ${error.message}`],
      warnings
    };
  }
}

/**
 * Validate OpenAI API key format
 * @param {string} apiKey - API key to validate
 * @returns {Object} Validation result
 */
export function validateApiKey(apiKey) {
  const errors = [];
  const warnings = [];

  try {
    if (!apiKey || typeof apiKey !== 'string') {
      errors.push('API key must be a non-empty string');
      return { isValid: false, errors, warnings };
    }

    const trimmedKey = apiKey.trim();

    // Basic format validation
    if (!trimmedKey.startsWith('sk-')) {
      errors.push('OpenAI API key must start with "sk-"');
    }

    if (trimmedKey.length < 20) {
      errors.push('API key appears to be too short');
    }

    if (trimmedKey.length > 100) {
      errors.push('API key appears to be too long');
    }

    // Check for common issues
    if (trimmedKey.includes(' ')) {
      errors.push('API key should not contain spaces');
    }

    if (trimmedKey !== apiKey) {
      warnings.push('API key has leading or trailing whitespace');
    }

    // Check for placeholder/example keys
    const placeholderPatterns = [
      'sk-your-key-here',
      'sk-replace-with-your-key',
      'sk-example',
      'sk-test'
    ];

    if (placeholderPatterns.some(pattern => trimmedKey.toLowerCase().includes(pattern))) {
      errors.push('API key appears to be a placeholder - please use your actual OpenAI API key');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  } catch (error) {
    logError('API key validation failed', { error: error.message });
    return {
      isValid: false,
      errors: [`Validation error: ${error.message}`],
      warnings
    };
  }
}

/**
 * Validate pagination parameters
 * @param {Object} params - Pagination parameters
 * @returns {Object} Validation result with normalized values
 */
export function validatePagination(params = {}) {
  const errors = [];
  const warnings = [];

  const {
    page = 1,
    limit = 10,
    maxLimit = 100
  } = params;

  let normalizedPage = parseInt(page, 10);
  let normalizedLimit = parseInt(limit, 10);

  // Page validation
  if (isNaN(normalizedPage) || normalizedPage < 1) {
    normalizedPage = 1;
    warnings.push('Page number must be a positive integer, defaulting to 1');
  }

  // Limit validation
  if (isNaN(normalizedLimit) || normalizedLimit < 1) {
    normalizedLimit = 10;
    warnings.push('Limit must be a positive integer, defaulting to 10');
  }

  if (normalizedLimit > maxLimit) {
    normalizedLimit = maxLimit;
    warnings.push(`Limit exceeds maximum allowed (${maxLimit}), capping at maximum`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    normalized: {
      page: normalizedPage,
      limit: normalizedLimit,
      offset: (normalizedPage - 1) * normalizedLimit
    }
  };
}

/**
 * Validate email address format
 * @param {string} email - Email to validate
 * @returns {Object} Validation result
 */
export function validateEmail(email) {
  const errors = [];

  if (!email || typeof email !== 'string') {
    errors.push('Email must be a non-empty string');
    return { isValid: false, errors };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    errors.push('Invalid email format');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Sanitize text input to prevent XSS and other security issues
 * @param {string} text - Text to sanitize
 * @param {Object} options - Sanitization options
 * @returns {string} Sanitized text
 */
export function sanitizeText(text, options = {}) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  const {
    removeHtml = true,
    trimWhitespace = true,
    maxLength = null
  } = options;

  let sanitized = text;

  if (removeHtml) {
    // Remove HTML tags
    sanitized = sanitized.replace(/<[^>]*>/g, '');
    
    // Decode HTML entities
    sanitized = sanitized
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }

  if (trimWhitespace) {
    sanitized = sanitized.trim();
    // Normalize multiple whitespaces to single space
    sanitized = sanitized.replace(/\s+/g, ' ');
  }

  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength).trim();
  }

  return sanitized;
}
