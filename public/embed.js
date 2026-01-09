(function () {
	'use strict';

	// Check if config exists
	const config = window.PlugRAGConfig;
	if (!config || !config.botId) {
		console.warn(
			'PlugRAG: Missing configuration. Please include botId in window.PlugRAGConfig'
		);
		return;
	}

	// Default configuration
	const defaultConfig = {
		color: '#f97316',
		position: 'bottom-right',
		greeting: 'Hi! How can I help you today?',
		placeholder: 'Type your message...',
		title: 'Chat Assistant',
		apiBase: 'https://localhost:3000', // Will be overridden by user's config
	};

	const finalConfig = { ...defaultConfig, ...config };

	// Session management
	const SESSION_STORAGE_KEY = `plugrag_session_${finalConfig.botId}`;
	const SESSION_EXPIRY_HOURS = 24;

	// Session utilities
	function getStoredSession() {
		try {
			const stored = localStorage.getItem(SESSION_STORAGE_KEY);
			if (!stored) return null;

			const session = JSON.parse(stored);
			const now = Date.now();

			// Check if session is expired
			if (now > session.expiresAt) {
				localStorage.removeItem(SESSION_STORAGE_KEY);
				return null;
			}

			return session;
		} catch (error) {
			console.error('PlugRAG: Error reading stored session:', error);
			return null;
		}
	}

	function saveSession(sessionId) {
		try {
			const session = {
				sessionId: sessionId,
				botId: finalConfig.botId,
				createdAt: Date.now(),
				expiresAt: Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000,
			};
			localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
		} catch (error) {
			console.error('PlugRAG: Error saving session:', error);
		}
	}

	function clearSession() {
		try {
			localStorage.removeItem(SESSION_STORAGE_KEY);
		} catch (error) {
			console.error('PlugRAG: Error clearing session:', error);
		}
	}

	// Get or create session ID
	function getSessionId() {
		const stored = getStoredSession();
		if (stored && stored.sessionId) {
			console.log('PlugRAG: Resuming existing session:', stored.sessionId);
			return stored.sessionId;
		}

		// Create new session
		const newSessionId =
			'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
		saveSession(newSessionId);
		console.log('PlugRAG: Created new session:', newSessionId);
		return newSessionId;
	}

	let sessionId = getSessionId();
	let isOpen = false;
	let messages = [];
	let historyLoaded = false;

	// Load conversation history from server
	async function loadConversationHistory() {
		const stored = getStoredSession();
		if (!stored || !stored.sessionId || historyLoaded) {
			return;
		}

		const messagesContainer = document.getElementById('plugrag-messages');
		if (!messagesContainer) return;

		try {
			console.log(
				'PlugRAG: Loading conversation history for session:',
				stored.sessionId
			);

			// Show loading indicator
			const loadingDiv = document.createElement('div');
			loadingDiv.id = 'plugrag-history-loading';
			loadingDiv.style.cssText = `
        text-align: center;
        padding: 12px;
        color: #9ca3af;
        font-size: 12px;
      `;
			loadingDiv.textContent = 'Loading previous conversation...';
			messagesContainer.appendChild(loadingDiv);

			const response = await fetch(
				`${finalConfig.apiBase}/api/chat/${finalConfig.botId}/history/${stored.sessionId}`
			);

			// Remove loading indicator
			const loadingIndicator = document.getElementById(
				'plugrag-history-loading'
			);
			if (loadingIndicator) {
				loadingIndicator.remove();
			}

			if (!response.ok) {
				throw new Error(`Failed to load history: ${response.status}`);
			}

			const data = await response.json();

			if (data.success && data.data?.messages) {
				const historicalMessages = data.data.messages;
				const isNewSession = data.data.isNewSession;

				// Only display history if there are messages and it's not a new session
				if (!isNewSession && historicalMessages.length > 0) {
					// Clear the default greeting
					messagesContainer.innerHTML = '';
					messages = [];

					// Add historical messages
					historicalMessages.forEach((msg) => {
						const sender = msg.role === 'user' ? 'user' : 'bot';
						addMessage(msg.content, sender, false, true); // true = skip push to messages array
					});

					// Add a subtle divider to indicate resuming conversation
					const resumeIndicator = document.createElement('div');
					resumeIndicator.style.cssText = `
          text-align: center;
          padding: 8px;
          margin: 8px 0;
          color: #9ca3af;
          font-size: 11px;
          border-top: 1px solid #e5e7eb;
          border-bottom: 1px solid #e5e7eb;
        `;
					resumeIndicator.textContent = 'Previous conversation resumed';
					messagesContainer.appendChild(resumeIndicator);

					historyLoaded = true;
					console.log(
						`PlugRAG: Loaded ${historicalMessages.length} messages from history`
					);

					// Auto-scroll to bottom after a brief delay
					setTimeout(() => {
						messagesContainer.scrollTop = messagesContainer.scrollHeight;
					}, 100);
				} else {
					console.log(
						'PlugRAG: No previous conversation found, starting fresh'
					);
				}
			}
		} catch (error) {
			console.error('PlugRAG: Error loading conversation history:', error);
			// Remove loading indicator if error occurs
			const loadingIndicator = document.getElementById(
				'plugrag-history-loading'
			);
			if (loadingIndicator) {
				loadingIndicator.remove();
			}
			// Don't break the widget if history fails to load
		}
	}

	// Create widget HTML structure
	function createWidget() {
		try {
			const widgetContainer = document.createElement('div');
			widgetContainer.id = 'plugrag-widget';
			widgetContainer.style.cssText = `
        position: fixed;
        ${
					finalConfig.position.includes('right')
						? 'right: 20px;'
						: 'left: 20px;'
				}
        bottom: 20px;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `;

			// Chat button
			const chatButton = document.createElement('button');
			chatButton.id = 'plugrag-chat-button';
			chatButton.style.cssText = `
        width: 50px;
        height: 50px;
        border-radius: 50%;
        border: none;
        background-color: ${finalConfig.color};
        color: white;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        transition: transform 0.2s ease;
      `;
			chatButton.innerHTML = `
			<svg
		className={className}
		fill="none"
		viewBox="0 0 24 24"
		strokeWidth={1.5}
		stroke="currentColor">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.740.194V21l4.155-4.155"
		/>
	</svg>
		`;
			chatButton.onmouseover = () =>
				(chatButton.style.transform = 'scale(1.1)');
			chatButton.onmouseout = () => (chatButton.style.transform = 'scale(1)');
			chatButton.onclick = toggleChat; // Chat window
			const chatWindow = document.createElement('div');
			chatWindow.id = 'plugrag-chat-window';
			chatWindow.style.cssText = `
        position: absolute;
        bottom: 60px;
        ${finalConfig.position.includes('right') ? 'right: 0;' : 'left: 0;'}
        width: 280px;
        height: 420px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        display: none;
        flex-direction: column;
        overflow: hidden;
      `;

			// Chat header
			const chatHeader = document.createElement('div');
			chatHeader.style.cssText = `
        background-color: ${finalConfig.color};
        color: white;
        padding: 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      `;

			const headerTitle = document.createElement('div');
			headerTitle.innerHTML = `
        <div style="font-weight: 600; font-size: 13px;">${finalConfig.title}</div>
        <div style="font-size: 11px; opacity: 0.9;">Online now</div>
      `;

			// Header actions container
			const headerActions = document.createElement('div');
			headerActions.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
      `;

			// New Chat button
			const newChatButton = document.createElement('button');
			newChatButton.innerHTML = '↻';
			newChatButton.title = 'Start new conversation';
			newChatButton.style.cssText = `
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        font-size: 14px;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        transition: background 0.2s ease;
      `;
			newChatButton.onmouseover = () =>
				(newChatButton.style.background = 'rgba(255, 255, 255, 0.3)');
			newChatButton.onmouseout = () =>
				(newChatButton.style.background = 'rgba(255, 255, 255, 0.2)');
			newChatButton.onclick = handleNewChat;

			const closeButton = document.createElement('button');
			closeButton.innerHTML = '✕';
			closeButton.style.cssText = `
        background: none;
        border: none;
        color: white;
        font-size: 16px;
        cursor: pointer;
        padding: 4px;
      `;
			closeButton.onclick = toggleChat;

			headerActions.appendChild(newChatButton);
			headerActions.appendChild(closeButton);

			chatHeader.appendChild(headerTitle);
			chatHeader.appendChild(headerActions);

			// Chat messages
			const messagesContainer = document.createElement('div');
			messagesContainer.id = 'plugrag-messages';
			messagesContainer.style.cssText = `
        flex: 1;
        padding: 12px;
        overflow-y: auto;
        background: #f9fafb;
      `;

			// Chat input
			const inputContainer = document.createElement('div');
			inputContainer.style.cssText = `
        padding: 12px;
        border-top: 1px solid #e5e7eb;
        background: white;
      `;

			const inputForm = document.createElement('form');
			inputForm.style.cssText = 'display: flex; gap: 6px;';

			const messageInput = document.createElement('input');
			messageInput.id = 'plugrag-message-input';
			messageInput.type = 'text';
			messageInput.placeholder = finalConfig.placeholder;
			messageInput.style.cssText = `
        flex: 1;
        padding: 8px 10px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        outline: none;
        font-size: 13px;
      `;
			messageInput.onfocus = () =>
				(messageInput.style.borderColor = finalConfig.color);
			messageInput.onblur = () => (messageInput.style.borderColor = '#d1d5db');

			const sendButton = document.createElement('button');
			sendButton.type = 'submit';
			sendButton.innerHTML = '→';
			sendButton.style.cssText = `
        padding: 8px 14px;
        background-color: ${finalConfig.color};
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: bold;
      `;

			inputForm.onsubmit = handleSendMessage;

			inputForm.appendChild(messageInput);
			inputForm.appendChild(sendButton);
			inputContainer.appendChild(inputForm);

			// Assemble chat window
			chatWindow.appendChild(chatHeader);
			chatWindow.appendChild(messagesContainer);
			chatWindow.appendChild(inputContainer);

			// Assemble widget
			widgetContainer.appendChild(chatButton);
			widgetContainer.appendChild(chatWindow);

			// Initial greeting - defer this until after widget is added to DOM
			setTimeout(() => {
				try {
					addMessage(finalConfig.greeting, 'bot');
				} catch (error) {
					console.error('PlugRAG: Error adding initial greeting:', error);
				}
			}, 100);

			return widgetContainer;
		} catch (error) {
			console.error('PlugRAG: Error in createWidget:', error);
			return null;
		}
	}

	function toggleChat() {
		const chatWindow = document.getElementById('plugrag-chat-window');
		const chatButton = document.getElementById('plugrag-chat-button');

		isOpen = !isOpen;

		if (isOpen) {
			chatWindow.style.display = 'flex';
			chatButton.innerHTML = '✕';
			// Focus input when opened
			setTimeout(() => {
				document.getElementById('plugrag-message-input')?.focus();
			}, 100);
		} else {
			chatWindow.style.display = 'none';
			chatButton.innerHTML = `
				<svg
		className={className}
		fill="none"
		viewBox="0 0 24 24"
		strokeWidth={1.5}
		stroke="currentColor">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.740.194V21l4.155-4.155"
		/>
	</svg>
			`;
		}
	}

	function handleNewChat() {
		// Confirm before clearing chat
		if (
			messages.length > 1 &&
			!confirm(
				'Start a new conversation? Your current chat history will be cleared.'
			)
		) {
			return;
		}

		// Clear session and messages
		clearSession();
		messages = [];
		historyLoaded = false;

		// Generate new session ID
		sessionId = getSessionId();

		// Clear messages container
		const messagesContainer = document.getElementById('plugrag-messages');
		if (messagesContainer) {
			messagesContainer.innerHTML = '';
		}

		// Add greeting message
		addMessage(finalConfig.greeting, 'bot');

		console.log('PlugRAG: Started new conversation:', sessionId);
	}

	function addMessage(content, sender, isLoading = false, skipPush = false) {
		const messagesContainer = document.getElementById('plugrag-messages');

		const messageDiv = document.createElement('div');
		messageDiv.style.cssText = `
      margin-bottom: 10px;
      display: flex;
      ${
				sender === 'user'
					? 'justify-content: flex-end;'
					: 'justify-content: flex-start;'
			}
    `;

		const messageBubble = document.createElement('div');
		messageBubble.style.cssText = `
      max-width: 80%;
      padding: 10px 12px;
      border-radius: 10px;
      font-size: 13px;
      line-height: 1.4;
      ${
				sender === 'user'
					? `background-color: ${finalConfig.color}; color: white; border-bottom-right-radius: 4px;`
					: 'background-color: white; color: #374151; border: 1px solid #e5e7eb; border-bottom-left-radius: 4px;'
			}
    `;

		if (isLoading) {
			messageBubble.innerHTML = `
        <div style="display: flex; gap: 3px; align-items: center;">
          <div style="width: 6px; height: 6px; background: #9ca3af; border-radius: 50%; animation: plugrag-pulse 1.4s ease-in-out infinite;"></div>
          <div style="width: 6px; height: 6px; background: #9ca3af; border-radius: 50%; animation: plugrag-pulse 1.4s ease-in-out 0.2s infinite;"></div>
          <div style="width: 6px; height: 6px; background: #9ca3af; border-radius: 50%; animation: plugrag-pulse 1.4s ease-in-out 0.4s infinite;"></div>
        </div>
      `;
			messageDiv.id = 'plugrag-loading-message';
		} else {
			messageBubble.textContent = content;
		}

		messageDiv.appendChild(messageBubble);
		messagesContainer.appendChild(messageDiv);
		messagesContainer.scrollTop = messagesContainer.scrollHeight;

		// Only push to messages array if not loading historical messages
		if (!skipPush) {
			messages.push({ content, sender, timestamp: Date.now() });
		}
	}

	function removeLoadingMessage() {
		const loadingMessage = document.getElementById('plugrag-loading-message');
		if (loadingMessage) {
			loadingMessage.remove();
		}
	}

	async function handleSendMessage(e) {
		e.preventDefault();

		const messageInput = document.getElementById('plugrag-message-input');
		const message = messageInput.value.trim();

		if (!message) return;

		// Add user message
		addMessage(message, 'user');
		messageInput.value = '';

		// Add loading indicator
		addMessage('', 'bot', true);

		try {
			// Send to chat API
			const response = await fetch(
				`${finalConfig.apiBase}/api/chat/${finalConfig.botId}`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						message: message,
						sessionId: sessionId,
						domain: window.location.hostname,
					}),
				}
			);

			const data = await response.json();

			// Remove loading message
			removeLoadingMessage();

			if (data.success) {
				// The API returns: { success: true, data: { message: "bot response" }, message: "Message sent successfully" }
				// We want the message from inside data, not the top-level message
				const botMessage = data.data?.message;

				if (botMessage) {
					addMessage(botMessage, 'bot');
				} else {
					console.warn('PlugRAG: No message found in response:', data);
					addMessage(
						'I received your message but had trouble responding. Please try again.',
						'bot'
					);
				}
			} else {
				addMessage('Sorry, I encountered an error. Please try again.', 'bot');
			}
		} catch (error) {
			console.error('PlugRAG: Error sending message:', error);
			removeLoadingMessage();
			addMessage(
				'Sorry, I could not connect to the server. Please try again.',
				'bot'
			);
		}
	}

	// Add CSS animations
	function addStyles() {
		try {
			if (!document.head) {
				console.warn('PlugRAG: document.head is null, skipping styles');
				return;
			}

			// Check if styles already exist
			if (document.getElementById('plugrag-styles')) {
				return;
			}

			const style = document.createElement('style');
			style.id = 'plugrag-styles';
			style.textContent = `
        @keyframes plugrag-pulse {
          0%, 80%, 100% {
            opacity: 0.4;
          }
          40% {
            opacity: 1;
          }
        }
      `;
			document.head.appendChild(style);
		} catch (error) {
			console.error('PlugRAG: Error adding styles:', error);
		}
	}

	// Initialize widget when DOM is ready
	function init() {
		// Prevent duplicate widgets
		if (document.getElementById('plugrag-widget')) {
			console.warn('PlugRAG: Widget already initialized');
			return;
		}

		try {
			// Multiple fallback strategies for finding a target element
			let targetElement = null;

			if (document.body) {
				targetElement = document.body;
			} else if (document.documentElement) {
				targetElement = document.documentElement;
			} else {
				// Create body if it doesn't exist (edge case)
				const body = document.createElement('body');
				if (document.documentElement) {
					document.documentElement.appendChild(body);
					targetElement = body;
				} else {
					console.error('PlugRAG: No valid DOM structure found');
					return;
				}
			}

			if (!targetElement) {
				console.error('PlugRAG: No valid target element found for widget');
				return;
			}

			addStyles();
			const widget = createWidget();

			if (!widget) {
				console.error('PlugRAG: Failed to create widget element');
				return;
			}

			targetElement.appendChild(widget);

			console.log(
				'PlugRAG: Chat widget initialized for bot:',
				finalConfig.botId
			);

			// Load conversation history after widget is initialized
			setTimeout(() => {
				loadConversationHistory();
			}, 200);
		} catch (error) {
			console.error('PlugRAG: Failed to initialize widget:', error);

			// Last resort: try again after a longer delay
			setTimeout(function () {
				if (!document.getElementById('plugrag-widget')) {
					init();
				}
			}, 2000);
		}
	}

	// Multiple initialization strategies to ensure widget loads
	function initializeWidget() {
		// Simple check - if we're in the script at the bottom of body, DOM should be ready
		if (document.body) {
			init();
			return;
		}

		// Fallback strategies
		if (document.readyState === 'complete') {
			setTimeout(init, 50);
		} else if (document.readyState === 'interactive') {
			// DOM is ready but resources might still be loading
			setTimeout(init, 100);
		} else {
			// DOM is still loading
			document.addEventListener('DOMContentLoaded', function () {
				setTimeout(init, 50);
			});

			// Additional fallback
			setTimeout(function () {
				if (!document.getElementById('plugrag-widget')) {
					init();
				}
			}, 1000);
		}
	}

	// Give the DOM a moment to be fully ready, then initialize
	setTimeout(initializeWidget, 10);
})();
