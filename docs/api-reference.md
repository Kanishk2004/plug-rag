# File Processing API Documentation

This document provides comprehensive examples of using the file processing APIs for your RAG chatbot system.

## 🚀 API Endpoints Overview

### **File Processing Endpoints**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/files` | POST | Upload and process single file |
| `/api/files` | GET | Get all files for a bot |
| `/api/files` | DELETE | Delete a file |
| `/api/files/[id]` | GET | Get file details with chunks |
| `/api/files/[id]` | POST | Reprocess file with new options |
| `/api/files/url` | POST | Process web URL content |
| `/api/files/batch` | POST | Process multiple files |
| `/api/files/batch` | GET | Get batch processing status |
| `/api/files/info` | GET | Get supported file types and options |

## 📁 **Single File Upload**

### Basic Upload
```javascript
import { fileProcessingAPI } from '@/lib/fileProcessingAPI';

// Upload a file with default settings
const result = await fileProcessingAPI.uploadFile(file, botId);

console.log('File processed:', result.file);
console.log('Total chunks:', result.extraction.chunks.length);
```

### Advanced Upload with Options
```javascript
const options = {
  maxChunkSize: 800,           // Larger chunks
  overlap: 150,                // More overlap
  respectStructure: true,      // Preserve document structure
  
  // PDF-specific options
  maxPages: 50,
  preserveFormatting: false,
  
  // DOCX-specific options
  includeHeaders: true,
  includeFooters: false,
  extractImages: true,
  
  // HTML-specific options
  extractLinks: true,
  maxContentLength: 2000000,
};

const result = await fileProcessingAPI.uploadFile(file, botId, options);
```

### Using React Hook
```jsx
import { useFileProcessing } from '@/lib/fileProcessingAPI';

function FileUploader({ botId }) {
  const { uploadFile, isProcessing, progress, error, results } = useFileProcessing();
  
  const handleFileUpload = async (file) => {
    try {
      const result = await uploadFile(file, botId, {
        maxChunkSize: 700,
        overlap: 100,
      });
      
      console.log('Upload successful:', result);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  return (
    <div>
      <input 
        type="file" 
        onChange={(e) => handleFileUpload(e.target.files[0])}
        disabled={isProcessing}
      />
      
      {isProcessing && (
        <div>
          Processing...
          {progress && (
            <div>
              Progress: {progress.totalProgress}%
              ({progress.completed} completed, {progress.errors} errors)
            </div>
          )}
        </div>
      )}
      
      {error && (
        <div className="error">
          Error: {error.message}
        </div>
      )}
      
      {results && (
        <div className="success">
          File processed successfully!
          <div>Chunks created: {results.extraction.chunks.length}</div>
          <div>Total tokens: {results.extraction.wordCount}</div>
        </div>
      )}
    </div>
  );
}
```

## 🌐 **Web URL Processing**

### Basic URL Processing
```javascript
const result = await fileProcessingAPI.processURL(
  'https://example.com/article',
  botId
);

console.log('Page title:', result.extraction.title);
console.log('Content extracted:', result.extraction.wordCount, 'words');
```

### Advanced URL Processing
```javascript
const options = {
  timeout: 60000,              // 60 second timeout
  maxContentLength: 5000000,   // 5MB max content
  extractLinks: true,          // Include links
  maxChunkSize: 600,
  overlap: 80,
};

const result = await fileProcessingAPI.processURL(url, botId, options);

// Access structured content
console.log('Headings:', result.extraction.structure.headings);
console.log('Links found:', result.extraction.links.length);
```

## 📦 **Batch Processing**

### Upload Multiple Files
```javascript
const files = [file1, file2, file3]; // File objects from input

const result = await fileProcessingAPI.uploadBatch(files, botId, {
  maxChunkSize: 700,
  overlap: 100,
});

console.log('Batch summary:', result.summary);
console.log('Successful files:', result.results);
console.log('Failed files:', result.errors);
```

### Track Batch Progress
```javascript
// Start batch processing
const batchResult = await fileProcessingAPI.uploadBatch(files, botId);
const batchJobId = batchResult.batchJobId;

// Poll for status updates
const checkProgress = async () => {
  const status = await fileProcessingAPI.getBatchStatus(batchJobId);
  
  console.log('Batch status:', status.batchJob.status);
  console.log('Progress:', status.batchJob.progress + '%');
  
  if (status.batchJob.status === 'completed') {
    console.log('Batch completed!', status.batchJob.result);
  } else if (status.batchJob.status === 'failed') {
    console.log('Batch failed:', status.batchJob.error);
  } else {
    // Still processing, check again in 2 seconds
    setTimeout(checkProgress, 2000);
  }
};

checkProgress();
```

## 📋 **File Management**

### Get All Files for a Bot
```javascript
const filesData = await fileProcessingAPI.getFiles(botId);

console.log('Total files:', filesData.total);
filesData.files.forEach(file => {
  console.log(`${file.originalName}: ${file.totalChunks} chunks, ${file.embeddingStatus}`);
});
```

### Get File Details with Chunks
```javascript
const fileDetails = await fileProcessingAPI.getFileDetails(fileId, {
  includeChunks: true,
  includeText: true,
});

console.log('File metadata:', fileDetails.file.metadata);
console.log('Full text:', fileDetails.file.extractedText);
console.log('Chunks:', fileDetails.chunks);
```

### Reprocess File with Different Options
```javascript
const newOptions = {
  maxChunkSize: 500,    // Smaller chunks
  overlap: 50,          // Less overlap
  respectStructure: false,
};

const result = await fileProcessingAPI.reprocessFile(fileId, newOptions);
console.log('Reprocessed with', result.chunks.length, 'new chunks');
```

### Delete a File
```javascript
await fileProcessingAPI.deleteFile(fileId);
console.log('File deleted successfully');
```

## ⚙️ **Configuration and Validation**

### Get Processing Information
```javascript
const info = await fileProcessingAPI.getProcessingInfo();

console.log('Supported file types:', info.supportedFileTypes);
console.log('File size limit:', info.limits.maxFileSize);
console.log('Processing options:', info.processingOptions);
```

### Validate Files Before Upload
```javascript
const files = [file1, file2, file3];
const validation = await fileProcessingAPI.validateFiles(files);

if (!validation.allValid) {
  validation.results.forEach(result => {
    if (!result.isValid) {
      console.error(`${result.file.name}:`, result.errors);
    }
    if (result.warnings.length > 0) {
      console.warn(`${result.file.name}:`, result.warnings);
    }
  });
} else {
  console.log('All files are valid for upload');
  console.log('Total size:', fileProcessingAPI.formatFileSize(validation.totalSize));
}
```

## 🔧 **Error Handling**

### Comprehensive Error Handling
```javascript
import { FileProcessingError } from '@/lib/fileProcessingAPI';

try {
  const result = await fileProcessingAPI.uploadFile(file, botId);
  // Handle success
} catch (error) {
  if (error instanceof FileProcessingError) {
    switch (error.status) {
      case 400:
        console.error('Validation error:', error.message);
        break;
      case 401:
        console.error('Authentication required');
        break;
      case 413:
        console.error('File too large');
        break;
      case 415:
        console.error('Unsupported file type');
        break;
      case 429:
        console.error('Plan limits reached');
        break;
      default:
        console.error('Processing error:', error.message);
    }
  } else {
    console.error('Network or other error:', error.message);
  }
}
```

## 📊 **Response Formats**

### Single File Upload Response
```json
{
  "success": true,
  "file": {
    "id": "64a7b8c9d0e1f2g3h4i5j6k7",
    "filename": "document_1698765432_abc123.pdf",
    "originalName": "document.pdf",
    "fileType": "pdf",
    "size": 1048576,
    "status": "completed",
    "totalChunks": 15,
    "totalTokens": 3500,
    "embeddingStatus": "pending",
    "processedAt": "2025-10-22T10:30:00.000Z"
  },
  "extraction": {
    "wordCount": 3500,
    "characterCount": 18750,
    "chunks": [
      {
        "id": "document_chunk_0_1698765432",
        "content": "Introduction to machine learning...",
        "tokens": 245,
        "type": "paragraph_boundary",
        "chunkIndex": 0
      }
    ],
    "metadata": {
      "title": "Machine Learning Guide",
      "author": "John Doe",
      "fileType": "pdf",
      "extractedAt": "2025-10-22T10:30:00.000Z"
    }
  },
  "processing": {
    "totalChunks": 15,
    "averageChunkSize": 233,
    "processedAt": "2025-10-22T10:30:00.000Z"
  }
}
```

### URL Processing Response
```json
{
  "success": true,
  "file": {
    "id": "64a7b8c9d0e1f2g3h4i5j6k8",
    "url": "https://example.com/article"
  },
  "extraction": {
    "title": "How to Build RAG Applications",
    "description": "A comprehensive guide to building RAG applications...",
    "structure": {
      "headings": [
        {"level": 1, "text": "Introduction"},
        {"level": 2, "text": "Setting Up"}
      ],
      "totalParagraphs": 25,
      "totalLists": 3,
      "totalTables": 1
    },
    "links": [
      {"url": "https://example.com/related", "text": "Related Article"}
    ]
  }
}
```

## 🎯 **Best Practices**

### 1. **File Validation**
Always validate files before upload to provide better user experience:

```javascript
const validation = await fileProcessingAPI.validateFiles([file]);
if (!validation.allValid) {
  // Show validation errors to user
  return;
}
```

### 2. **Progress Tracking**
Use progress tracking for better UX:

```javascript
const { uploadFile, progress, isProcessing } = useFileProcessing();

// Show progress bar based on progress.totalProgress
```

### 3. **Error Recovery**
Implement retry logic for failed uploads:

```javascript
const uploadWithRetry = async (file, botId, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fileProcessingAPI.uploadFile(file, botId);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};
```

### 4. **Chunking Strategy**
Choose optimal chunking based on use case:

```javascript
// For Q&A systems - smaller, precise chunks
const qaOptions = {
  maxChunkSize: 400,
  overlap: 50,
  respectStructure: true,
};

// For summarization - larger chunks
const summaryOptions = {
  maxChunkSize: 1000,
  overlap: 200,
  respectStructure: false,
};
```

This API system provides a robust, production-ready foundation for file processing in your RAG chatbot application!