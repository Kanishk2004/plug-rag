/**
 * Client-side API utilities for file processing
 * Provides easy-to-use functions for interacting with the file processing APIs
 */

import { useState, useCallback, useMemo } from 'react';

export class FileProcessingAPI {
  constructor(baseURL = '/api/files') {
    this.baseURL = baseURL;
  }

  /**
   * Upload and process a single file
   */
  async uploadFile(file, botId, options = {}) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('botId', botId);
    formData.append('options', JSON.stringify(options));

    const response = await fetch(this.baseURL, {
      method: 'POST',
      body: formData,
    });

    return this.handleResponse(response);
  }

  /**
   * Process a web URL
   */
  async processURL(url, botId, options = {}) {
    const response = await fetch(`${this.baseURL}/url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        botId,
        options,
      }),
    });

    return this.handleResponse(response);
  }

  /**
   * Upload and process multiple files
   */
  async uploadBatch(files, botId, options = {}) {
    const formData = new FormData();
    formData.append('botId', botId);
    formData.append('options', JSON.stringify(options));
    
    files.forEach((file, index) => {
      formData.append(`file_${index}`, file);
    });

    const response = await fetch(`${this.baseURL}/batch`, {
      method: 'POST',
      body: formData,
    });

    return this.handleResponse(response);
  }

  /**
   * Get batch processing status
   */
  async getBatchStatus(batchJobId) {
    const response = await fetch(`${this.baseURL}/batch?batchJobId=${batchJobId}`);
    return this.handleResponse(response);
  }

  /**
   * Get all files for a bot
   */
  async getFiles(botId) {
    const response = await fetch(`${this.baseURL}?botId=${botId}`);
    return this.handleResponse(response);
  }

  /**
   * Get file details
   */
  async getFileDetails(fileId, options = {}) {
    const params = new URLSearchParams();
    if (options.includeChunks) params.append('includeChunks', 'true');
    if (options.includeText) params.append('includeText', 'true');
    
    const url = `${this.baseURL}/${fileId}${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url);
    return this.handleResponse(response);
  }

  /**
   * Reprocess a file with new options
   */
  async reprocessFile(fileId, options = {}) {
    const response = await fetch(`${this.baseURL}/${fileId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ options }),
    });

    return this.handleResponse(response);
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId) {
    const response = await fetch(`${this.baseURL}?fileId=${fileId}`, {
      method: 'DELETE',
    });

    return this.handleResponse(response);
  }

  /**
   * Get supported file types and processing info
   */
  async getProcessingInfo() {
    const response = await fetch(`${this.baseURL}/info`);
    return this.handleResponse(response);
  }

  /**
   * Validate files before upload
   */
  async validateFiles(files) {
    const processingInfo = await this.getProcessingInfo();
    const { limits } = processingInfo;
    
    const results = files.map(file => {
      const errors = [];
      const warnings = [];

      // Check file size
      if (file.size > limits.maxFileSize) {
        errors.push(`File size (${this.formatFileSize(file.size)}) exceeds maximum allowed size (${this.formatFileSize(limits.maxFileSize)})`);
      }

      // Check file type
      const extension = file.name.toLowerCase().split('.').pop();
      if (!limits.allowedExtensions.includes(`.${extension}`)) {
        errors.push(`File type ".${extension}" is not supported`);
      }

      // Check MIME type
      if (file.type && !limits.allowedMimeTypes.includes(file.type)) {
        warnings.push(`MIME type "${file.type}" may not be supported`);
      }

      // Size warnings
      if (file.size > 10 * 1024 * 1024) { // 10MB
        warnings.push('Large file detected - processing may take longer');
      }

      return {
        file,
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    });

    return {
      allValid: results.every(r => r.isValid),
      results,
      totalSize: files.reduce((sum, file) => sum + file.size, 0),
    };
  }

  /**
   * Handle API response
   */
  async handleResponse(response) {
    const data = await response.json();
    
    if (!response.ok) {
      throw new FileProcessingError(data.error, response.status, data);
    }
    
    return data;
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Create progress tracker for file uploads
   */
  createProgressTracker(onProgress) {
    return new FileUploadProgress(onProgress);
  }
}

/**
 * Custom error class for file processing
 */
export class FileProcessingError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'FileProcessingError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Progress tracker for file uploads
 */
export class FileUploadProgress {
  constructor(onProgress) {
    this.onProgress = onProgress;
    this.uploads = new Map();
  }

  start(fileId, fileName) {
    this.uploads.set(fileId, {
      fileName,
      progress: 0,
      status: 'uploading',
      startTime: Date.now(),
    });
    this.notifyProgress();
  }

  update(fileId, progress) {
    const upload = this.uploads.get(fileId);
    if (upload) {
      upload.progress = progress;
      upload.status = progress === 100 ? 'processing' : 'uploading';
      this.notifyProgress();
    }
  }

  complete(fileId, result) {
    const upload = this.uploads.get(fileId);
    if (upload) {
      upload.progress = 100;
      upload.status = 'completed';
      upload.result = result;
      upload.endTime = Date.now();
      this.notifyProgress();
    }
  }

  error(fileId, error) {
    const upload = this.uploads.get(fileId);
    if (upload) {
      upload.status = 'error';
      upload.error = error;
      upload.endTime = Date.now();
      this.notifyProgress();
    }
  }

  notifyProgress() {
    if (this.onProgress) {
      const uploads = Array.from(this.uploads.values());
      const totalProgress = uploads.reduce((sum, upload) => sum + upload.progress, 0) / uploads.length;
      
      this.onProgress({
        uploads,
        totalProgress,
        completed: uploads.filter(u => u.status === 'completed').length,
        errors: uploads.filter(u => u.status === 'error').length,
        inProgress: uploads.filter(u => ['uploading', 'processing'].includes(u.status)).length,
      });
    }
  }

  clear() {
    this.uploads.clear();
    this.notifyProgress();
  }
}

/**
 * React hook for file processing
 */
export function useFileProcessing() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);

  const api = useMemo(() => new FileProcessingAPI(), []);
  const progressTracker = useMemo(() => 
    api.createProgressTracker(setProgress), [api]);

  const uploadFile = useCallback(async (file, botId, options = {}) => {
    setIsProcessing(true);
    setError(null);
    setResults(null);

    try {
      const fileId = `${file.name}_${Date.now()}`;
      progressTracker.start(fileId, file.name);

      const result = await api.uploadFile(file, botId, options);
      
      progressTracker.complete(fileId, result);
      setResults(result);
      
      return result;
    } catch (err) {
      progressTracker.error(fileId, err);
      setError(err);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [api, progressTracker]);

  const uploadBatch = useCallback(async (files, botId, options = {}) => {
    setIsProcessing(true);
    setError(null);
    setResults(null);

    try {
      // Start tracking for all files
      files.forEach((file, index) => {
        const fileId = `${file.name}_${index}_${Date.now()}`;
        progressTracker.start(fileId, file.name);
      });

      const result = await api.uploadBatch(files, botId, options);
      
      // Update progress for each file based on results
      result.results.forEach((fileResult, index) => {
        const fileId = `${files[index].name}_${index}_${Date.now()}`;
        progressTracker.complete(fileId, fileResult);
      });

      result.errors.forEach((error, index) => {
        const fileId = `${error.filename}_${index}_${Date.now()}`;
        progressTracker.error(fileId, error);
      });

      setResults(result);
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [api, progressTracker]);

  const processURL = useCallback(async (url, botId, options = {}) => {
    setIsProcessing(true);
    setError(null);
    setResults(null);

    try {
      const result = await api.processURL(url, botId, options);
      setResults(result);
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [api]);

  const reset = useCallback(() => {
    setIsProcessing(false);
    setProgress(null);
    setError(null);
    setResults(null);
    progressTracker.clear();
  }, [progressTracker]);

  return {
    api,
    isProcessing,
    progress,
    error,
    results,
    uploadFile,
    uploadBatch,
    processURL,
    reset,
  };
}

// Export singleton instance for direct use
export const fileProcessingAPI = new FileProcessingAPI();