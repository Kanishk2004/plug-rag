import { useState, useCallback } from 'react';

/**
 * Custom hook for managing notifications
 * @returns {{ notification: {message: string, type: string} | null, showNotification: (message: string, type?: string) => void }}
 */
export function useNotification() {
	const [notification, setNotification] = useState(null);

	const showNotification = useCallback((message, type = 'success') => {
		setNotification({ message, type });
		setTimeout(() => setNotification(null), 5000);
	}, []);

	return { notification, showNotification };
}
