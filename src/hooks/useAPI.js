import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for fetching and managing bots
 */
export function useBots(options = {}) {
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({});

  const { 
    page = 1, 
    limit = 10, 
    status = 'all',
    search = '',
    autoRefresh = false,
    refreshInterval = 30000 
  } = options;

  const fetchBots = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(status !== 'all' && { status }),
        ...(search && { search })
      });

      const response = await fetch(`/api/bots?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch bots: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        // Handle standardized response format
        if (data.data && data.data.items) {
          // Paginated response format
          setBots(data.data.items || []);
          setPagination(data.data.pagination || {});
        } else {
          // Direct array response
          setBots(data.data || []);
          setPagination({});
        }
      } else {
        throw new Error(data.error || 'Failed to fetch bots');
      }
    } catch (err) {
      console.error('Error fetching bots:', err);
      setError(err.message);
      setBots([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, status, search]);

  // Initial fetch and auto-refresh setup
  useEffect(() => {
    fetchBots();

    if (autoRefresh) {
      const interval = setInterval(fetchBots, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchBots, autoRefresh, refreshInterval]);

  return {
    bots,
    loading,
    error,
    pagination,
    refetch: fetchBots,
    setBots
  };
}

/**
 * Custom hook for managing individual bot operations
 */
export function useBot(botId) {
  const [bot, setBot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(false);

  const fetchBot = useCallback(async () => {
    if (!botId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/bots/${botId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch bot: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setBot(data.data || null);
      } else {
        throw new Error(data.error || 'Failed to fetch bot');
      }
    } catch (err) {
      console.error('Error fetching bot:', err);
      setError(err.message);
      setBot(null);
    } finally {
      setLoading(false);
    }
  }, [botId]);

  const updateBot = useCallback(async (updates) => {
    if (!botId) return { success: false, error: 'No bot ID provided' };

    try {
      setUpdating(true);
      setError(null);

      const response = await fetch(`/api/bots/${botId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to update bot: ${response.status}`);
      }

      if (data.success) {
        setBot(data.data || null);
        return { success: true, bot: data.data };
      } else {
        throw new Error(data.error || 'Failed to update bot');
      }
    } catch (err) {
      console.error('Error updating bot:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setUpdating(false);
    }
  }, [botId]);

  const toggleStatus = useCallback(async () => {
    if (!bot) return { success: false, error: 'No bot loaded' };

    const newStatus = bot.status === 'active' ? 'inactive' : 'active';
    return await updateBot({ status: newStatus });
  }, [bot, updateBot]);

  useEffect(() => {
    fetchBot();
  }, [fetchBot]);

  return {
    bot,
    loading,
    error,
    updating,
    refetch: fetchBot,
    updateBot,
    toggleStatus,
    setBot
  };
}

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
        if (data.data && data.data.files) {
          // Response with files array
          setFiles(data.data.files || []);
        } else if (Array.isArray(data.data)) {
          // Direct array response
          setFiles(data.data || []);
        } else {
          setFiles([]);
        }
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
    if (!botId || !file) {
      return { success: false, error: 'Bot ID and file are required' };
    }

    try {
      setUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('botId', botId);
      
      // Add any additional options
      if (options.maxChunkSize) {
        formData.append('maxChunkSize', options.maxChunkSize.toString());
      }
      if (options.overlap) {
        formData.append('overlap', options.overlap.toString());
      }

      const response = await fetch('/api/files', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Upload failed: ${response.status}`);
      }

      if (data.success) {
        // Extract file data from standardized response
        const fileData = data.data || {};
        
        // Add the new file to the list
        setFiles(prev => [fileData, ...prev]);
        
        // Start tracking processing status if the file is processing
        if (fileData.embeddingStatus === 'pending' || fileData.embeddingStatus === 'processing') {
          setProcessingFiles(prev => new Set([...prev, fileData.id || fileData._id]));
        }

        return { success: true, file: fileData };
      } else {
        throw new Error(data.error || 'Upload failed');
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

/**
 * Custom hook for creating new bots
 */
export function useCreateBot() {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  const createBot = useCallback(async (botData) => {
    try {
      setCreating(true);
      setError(null);

      const response = await fetch('/api/bots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(botData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to create bot: ${response.status}`);
      }

      if (data.success) {
        return { success: true, bot: data.data };
      } else {
        throw new Error(data.error || 'Failed to create bot');
      }
    } catch (err) {
      console.error('Error creating bot:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setCreating(false);
    }
  }, []);

  return {
    createBot,
    creating,
    error
  };
}