import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for managing files for a specific bot
 */
export function useBotFiles(botId) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [processingFiles, setProcessingFiles] = useState(new Set());

  const fetchFiles = useCallback(async () => {
    if (!botId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/files?botId=${botId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch files: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        // Handle standardized response format
        setFiles(data.data || []);
      } else {
        throw new Error(data.error || 'Failed to fetch files');
      }
    } catch (err) {
      console.error('Error fetching files:', err);
      setError(err.message);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [botId]);

  const uploadFile = useCallback(async (file, options = {}) => {
    // This function is deprecated. Use fileAPI.uploadMultiple() from lib/api.js instead
    console.warn('useBotFiles.uploadFile is deprecated. Use fileAPI.uploadMultiple() instead.');
    
    if (!botId || !file) {
      return { success: false, error: 'Bot ID and file are required' };
    }

    try {
      setUploading(true);
      setError(null);

      // Use the consolidated fileAPI instead
      const { fileAPI } = await import('../lib/api.js');
      const result = await fileAPI.uploadMultiple([file], botId, {
        onProgress: () => {}, // No progress callback for single file
        maxChunkSize: options.maxChunkSize,
        overlap: options.overlap
      });

      if (result.success && result.results.length > 0) {
        const fileData = result.results[0];
        
        // Add the new file to the list
        setFiles(prev => [fileData, ...prev]);
        
        // Start tracking processing status if the file is processing
        if (fileData.embeddingStatus === 'pending' || fileData.embeddingStatus === 'processing') {
          setProcessingFiles(prev => new Set([...prev, fileData.id || fileData._id]));
        }

        return { success: true, file: fileData };
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (err) {
      console.error('Error uploading file:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setUploading(false);
    }
  }, [botId]);

  const deleteFile = useCallback(async (fileId) => {
    if (!fileId) {
      return { success: false, error: 'File ID is required' };
    }

    try {
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Delete failed: ${response.status}`);
      }

      if (data.success) {
        // Remove the file from the list
        setFiles(prev => prev.filter(f => f.id !== fileId));
        setProcessingFiles(prev => {
          const newSet = new Set(prev);
          newSet.delete(fileId);
          return newSet;
        });

        return { success: true };
      } else {
        throw new Error(data.error || 'Delete failed');
      }
    } catch (err) {
      console.error('Error deleting file:', err);
      return { success: false, error: err.message };
    }
  }, []);

  const retryProcessing = useCallback(async (fileId) => {
    if (!fileId) {
      return { success: false, error: 'File ID is required' };
    }

    try {
      setProcessingFiles(prev => new Set([...prev, fileId]));

      const response = await fetch(`/api/files/${fileId}/retry`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Retry failed: ${response.status}`);
      }

      if (data.success) {
        // Update the file status in the list
        setFiles(prev => prev.map(f => 
          f.id === fileId ? { ...f, embeddingStatus: 'pending', error: null } : f
        ));

        return { success: true };
      } else {
        throw new Error(data.error || 'Retry failed');
      }
    } catch (err) {
      console.error('Error retrying file processing:', err);
      setProcessingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileId);
        return newSet;
      });
      return { success: false, error: err.message };
    }
  }, []);

  // Poll for file processing status updates
  useEffect(() => {
    if (processingFiles.size === 0) return;

    const pollProcessingStatus = async () => {
      try {
        const fileIds = Array.from(processingFiles);
        const promises = fileIds.map(async (fileId) => {
          const response = await fetch(`/api/files/${fileId}/status`);
          if (response.ok) {
            const data = await response.json();
            // Handle standardized response format
            const statusData = data.data || data;
            return { 
              fileId, 
              status: statusData.embeddingStatus || data.embeddingStatus, 
              error: statusData.error || data.error 
            };
          }
          return null;
        });

        const results = await Promise.all(promises);
        const completedFiles = new Set();

        results.forEach((result) => {
          if (result) {
            const { fileId, status, error } = result;
            
            // Update file status in the list
            setFiles(prev => prev.map(f => 
              f.id === fileId ? { ...f, embeddingStatus: status, error } : f
            ));

            // If processing is complete (success or failure), remove from processing set
            if (status === 'completed' || status === 'failed' || status === 'generated') {
              completedFiles.add(fileId);
            }
          }
        });

        // Remove completed files from processing set
        if (completedFiles.size > 0) {
          setProcessingFiles(prev => {
            const newSet = new Set(prev);
            completedFiles.forEach(fileId => newSet.delete(fileId));
            return newSet;
          });
        }
      } catch (err) {
        console.error('Error polling file status:', err);
      }
    };

    const interval = setInterval(pollProcessingStatus, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, [processingFiles]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  return {
    files,
    loading,
    error,
    uploading,
    processingFiles,
    refetch: fetchFiles,
    uploadFile,
    deleteFile,
    retryProcessing,
    setFiles
  };
}