import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for managing conversations data and operations
 * 
 * Features:
 * - Fetch conversations with pagination and filtering
 * - Fetch detailed conversation data
 * - Delete conversations
 * - Real-time data management
 * - Loading states and error handling
 */
export const useConversations = (botId) => {
	// Conversations list state
	const [conversations, setConversations] = useState([]);
	const [pagination, setPagination] = useState({
		currentPage: 1,
		totalPages: 0,
		totalCount: 0,
		limit: 20,
		hasNextPage: false,
		hasPrevPage: false
	});
	const [statistics, setStatistics] = useState({
		totalConversations: 0,
		activeConversations: 0,
		totalMessages: 0,
		totalTokens: 0,
		avgMessagesPerConversation: 0,
		lastActivity: null
	});
	
	// UI state
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	
	// Filters
	const [filters, setFilters] = useState({
		page: 1,
		limit: 20,
		status: 'all',
		dateFrom: null,
		dateTo: null,
		search: '',
		domain: ''
	});

	// Processing state for individual operations
	const [processingConversations, setProcessingConversations] = useState(new Set());

	/**
	 * Fetch conversations from the API
	 */
	const fetchConversations = useCallback(async (customFilters = {}) => {
		if (!botId) return;

		setLoading(true);
		setError(null);

		try {
			const mergedFilters = { ...filters, ...customFilters };
			const params = new URLSearchParams();

			// Add non-empty filter parameters
			Object.entries(mergedFilters).forEach(([key, value]) => {
				if (value !== null && value !== undefined && value !== '') {
					params.append(key, value.toString());
				}
			});

			const response = await fetch(`/api/bots/${botId}/conversations?${params.toString()}`);
			
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to fetch conversations');
			}

			const data = await response.json();

			if (data.success) {
				setConversations(data.data.conversations || []);
				setPagination(data.data.pagination || {});
				setStatistics(data.data.statistics || {});
				setFilters(mergedFilters);
			} else {
				throw new Error(data.error || 'Failed to fetch conversations');
			}
		} catch (err) {
			console.error('Error fetching conversations:', err);
			setError(err.message);
			setConversations([]);
		} finally {
			setLoading(false);
		}
	}, [botId, filters]);

	/**
	 * Load next page of conversations
	 */
	const loadNextPage = useCallback(() => {
		if (pagination.hasNextPage && !loading) {
			fetchConversations({ page: pagination.currentPage + 1 });
		}
	}, [pagination.hasNextPage, pagination.currentPage, loading, fetchConversations]);

	/**
	 * Load previous page of conversations
	 */
	const loadPreviousPage = useCallback(() => {
		if (pagination.hasPrevPage && !loading) {
			fetchConversations({ page: pagination.currentPage - 1 });
		}
	}, [pagination.hasPrevPage, pagination.currentPage, loading, fetchConversations]);

	/**
	 * Go to specific page
	 */
	const goToPage = useCallback((page) => {
		if (page >= 1 && page <= pagination.totalPages && !loading) {
			fetchConversations({ page });
		}
	}, [pagination.totalPages, loading, fetchConversations]);

	/**
	 * Apply filters and search
	 */
	const applyFilters = useCallback((newFilters) => {
		fetchConversations({ ...newFilters, page: 1 });
	}, [fetchConversations]);

	/**
	 * Reset filters to default
	 */
	const resetFilters = useCallback(() => {
		const defaultFilters = {
			page: 1,
			limit: 20,
			status: 'all',
			dateFrom: null,
			dateTo: null,
			search: '',
			domain: ''
		};
		fetchConversations(defaultFilters);
	}, [fetchConversations]);

	/**
	 * Refresh current data
	 */
	const refresh = useCallback(() => {
		fetchConversations();
	}, [fetchConversations]);

	/**
	 * Delete a conversation
	 */
	const deleteConversation = useCallback(async (sessionId) => {
		if (!botId || !sessionId) {
			throw new Error('Bot ID and Session ID are required');
		}

		// Add to processing set
		setProcessingConversations(prev => new Set([...prev, sessionId]));

		try {
			const response = await fetch(`/api/bots/${botId}/conversations/${sessionId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to delete conversation');
			}

			const data = await response.json();

			if (data.success) {
				// Remove conversation from local state
				setConversations(prev => 
					prev.filter(conv => conv.sessionId !== sessionId)
				);

				// Update statistics
				setStatistics(prev => ({
					...prev,
					totalConversations: Math.max(0, prev.totalConversations - 1)
				}));

				// Update pagination if needed
				setPagination(prev => ({
					...prev,
					totalCount: Math.max(0, prev.totalCount - 1)
				}));

				return { success: true };
			} else {
				throw new Error(data.error || 'Failed to delete conversation');
			}
		} catch (err) {
			console.error('Error deleting conversation:', err);
			return { success: false, error: err.message };
		} finally {
			// Remove from processing set
			setProcessingConversations(prev => {
				const newSet = new Set(prev);
				newSet.delete(sessionId);
				return newSet;
			});
		}
	}, [botId]);

	/**
	 * Get conversation detail
	 */
	const getConversationDetail = useCallback(async (sessionId, options = {}) => {
		if (!botId || !sessionId) {
			throw new Error('Bot ID and Session ID are required');
		}

		try {
			const params = new URLSearchParams();
			
			// Add options as query parameters
			Object.entries(options).forEach(([key, value]) => {
				if (value !== null && value !== undefined) {
					params.append(key, value.toString());
				}
			});

			const url = `/api/bots/${botId}/conversations/${sessionId}${params.toString() ? `?${params.toString()}` : ''}`;
			const response = await fetch(url);

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to fetch conversation detail');
			}

			const data = await response.json();

			if (data.success) {
				return data.data;
			} else {
				throw new Error(data.error || 'Failed to fetch conversation detail');
			}
		} catch (err) {
			console.error('Error fetching conversation detail:', err);
			throw err;
		}
	}, [botId]);

	/**
	 * Search conversations
	 */
	const searchConversations = useCallback((searchTerm) => {
		applyFilters({ search: searchTerm });
	}, [applyFilters]);

	/**
	 * Filter by status
	 */
	const filterByStatus = useCallback((status) => {
		applyFilters({ status });
	}, [applyFilters]);

	/**
	 * Filter by date range
	 */
	const filterByDateRange = useCallback((dateFrom, dateTo) => {
		applyFilters({ dateFrom, dateTo });
	}, [applyFilters]);

	/**
	 * Filter by domain
	 */
	const filterByDomain = useCallback((domain) => {
		applyFilters({ domain });
	}, [applyFilters]);

	// Initial data load
	useEffect(() => {
		if (botId) {
			fetchConversations();
		}
	}, [botId]); // Only depend on botId to avoid infinite loops

	// Return hook interface
	return {
		// Data
		conversations,
		pagination,
		statistics,
		filters,

		// State
		loading,
		error,
		processingConversations,

		// Actions
		fetchConversations,
		refresh,
		deleteConversation,
		getConversationDetail,

		// Navigation
		loadNextPage,
		loadPreviousPage,
		goToPage,

		// Filtering
		applyFilters,
		resetFilters,
		searchConversations,
		filterByStatus,
		filterByDateRange,
		filterByDomain,

		// Utilities
		isConversationProcessing: (sessionId) => processingConversations.has(sessionId),
	};
};

/**
 * Hook for managing a single conversation detail view
 */
export const useConversationDetail = (botId, sessionId) => {
	const [conversationDetail, setConversationDetail] = useState(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);

	const fetchConversationDetail = useCallback(async (options = {}) => {
		if (!botId || !sessionId) return;

		setLoading(true);
		setError(null);

		try {
			const params = new URLSearchParams();
			
			Object.entries(options).forEach(([key, value]) => {
				if (value !== null && value !== undefined) {
					params.append(key, value.toString());
				}
			});

			const url = `/api/bots/${botId}/conversations/${sessionId}${params.toString() ? `?${params.toString()}` : ''}`;
			const response = await fetch(url);

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to fetch conversation detail');
			}

			const data = await response.json();

			if (data.success) {
				setConversationDetail(data.data);
			} else {
				throw new Error(data.error || 'Failed to fetch conversation detail');
			}
		} catch (err) {
			console.error('Error fetching conversation detail:', err);
			setError(err.message);
			setConversationDetail(null);
		} finally {
			setLoading(false);
		}
	}, [botId, sessionId]);

	const deleteConversation = useCallback(async () => {
		if (!botId || !sessionId) {
			throw new Error('Bot ID and Session ID are required');
		}

		try {
			const response = await fetch(`/api/bots/${botId}/conversations/${sessionId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to delete conversation');
			}

			const data = await response.json();

			if (data.success) {
				return { success: true };
			} else {
				throw new Error(data.error || 'Failed to delete conversation');
			}
		} catch (err) {
			console.error('Error deleting conversation:', err);
			return { success: false, error: err.message };
		}
	}, [botId, sessionId]);

	// Initial load
	useEffect(() => {
		if (botId && sessionId) {
			fetchConversationDetail();
		}
	}, [botId, sessionId, fetchConversationDetail]);

	return {
		conversationDetail,
		loading,
		error,
		refresh: fetchConversationDetail,
		deleteConversation
	};
};

export default useConversations;