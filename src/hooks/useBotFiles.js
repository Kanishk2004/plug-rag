import { useState, useEffect, useCallback } from 'react';
import { fileAPI } from '@/lib/clientAPI';

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
    deleteFile,
    setFiles
  };
}
