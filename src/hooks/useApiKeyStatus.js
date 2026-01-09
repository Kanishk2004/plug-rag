import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for managing API key status
 * @param {string} botId - The bot ID to check API key status for
 * @returns {{ status: {hasCustomKey: boolean, keyStatus: string, loading: boolean}, refresh: () => Promise<void> }}
 */
export function useApiKeyStatus(botId) {
	const [status, setStatus] = useState({
		hasCustomKey: false,
		keyStatus: 'none',
		loading: true,
	});

	const refresh = useCallback(async () => {
		if (!botId) return;

		try {
			setStatus((prev) => ({ ...prev, loading: true }));

			const response = await fetch(`/api/bots/${botId}/api-keys`);
			if (response.ok) {
				const data = await response.json();
				setStatus({
					hasCustomKey: data.data.hasCustomKey,
					keyStatus: data.data.keyStatus,
					loading: false,
				});
			} else {
				setStatus({
					hasCustomKey: false,
					keyStatus: 'none',
					loading: false,
				});
			}
		} catch (error) {
			console.error('Error checking API key status:', error);
			setStatus({
				hasCustomKey: false,
				keyStatus: 'none',
				loading: false,
			});
		}
	}, [botId]);

	useEffect(() => {
		refresh();
	}, [refresh]);

	return { status, refresh };
}
