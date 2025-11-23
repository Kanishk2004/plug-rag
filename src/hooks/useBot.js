import { useState, useEffect, useCallback } from 'react';

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

  const deleteBot = useCallback(async () => {
    if (!botId) return { success: false, error: 'No bot ID provided' };

    try {
      setUpdating(true);
      setError(null);

      const response = await fetch(`/api/bots/${botId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to delete bot: ${response.status}`);
      }

      if (data.success) {
        setBot(null);
        return { success: true, deletionSummary: data.data };
      } else {
        throw new Error(data.error || 'Failed to delete bot');
      }
    } catch (err) {
      console.error('Error deleting bot:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setUpdating(false);
    }
  }, [botId]);

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
    deleteBot,
    setBot
  };
}
