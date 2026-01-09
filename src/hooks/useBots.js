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
		refreshInterval = 120000,
	} = options;

	const fetchBots = useCallback(async (signal) => {
		try {
			setLoading(true);
			setError(null);

			const params = new URLSearchParams({
				page: page.toString(),
				limit: limit.toString(),
				...(status !== 'all' && { status }),
				...(search && { search }),
			});

			const response = await fetch(`/api/bots?${params}`, { signal });

			if (!response.ok) {
				throw new Error(
					`Failed to fetch bots: ${response.status} ${response.statusText}`
				);
			}

			const data = await response.json();

			// Check if request was cancelled before updating state
			if (signal?.aborted) return;

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
			// Ignore abort errors (they're intentional)
			if (err.name === 'AbortError') return;
			
			console.error('Error fetching bots:', err);
			setError(err.message);
			setBots([]);
		} finally {
			if (!signal?.aborted) {
				setLoading(false);
			}
		}
	}, [page, limit, status, search]);

	// Initial fetch and auto-refresh setup
	useEffect(() => {
		// Create AbortController to cancel requests if dependencies change
		const abortController = new AbortController();
		fetchBots(abortController.signal);

		if (autoRefresh) {
			const interval = setInterval(() => {
				// Create new controller for each interval request
				const intervalController = new AbortController();
				fetchBots(intervalController.signal);
			}, refreshInterval);
			
			return () => {
				clearInterval(interval);
				abortController.abort();
			};
		}

		// Cleanup: abort pending request when component unmounts or dependencies change
		return () => {
			abortController.abort();
		};
	}, [fetchBots, autoRefresh, refreshInterval]);

	return {
		bots,
		loading,
		error,
		pagination,
		refetch: fetchBots,
		setBots,
	};
}
