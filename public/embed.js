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
		apiBase: 'https://localhost:3000', // Will be overridden by user's config
	};

	const finalConfig = { ...defaultConfig, ...config };

	// Create unique session ID for this page load
	const sessionId =
		'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
	let isOpen = false;
	let messages = [];

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
        width: 60px;
        height: 60px;
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
			chatButton.innerHTML = '💬';
			chatButton.onmouseover = () =>
				(chatButton.style.transform = 'scale(1.1)');
			chatButton.onmouseout = () => (chatButton.style.transform = 'scale(1)');
			chatButton.onclick = toggleChat;

			// Chat window
			const chatWindow = document.createElement('div');
			chatWindow.id = 'plugrag-chat-window';
			chatWindow.style.cssText = `
        position: absolute;
        bottom: 70px;
        ${finalConfig.position.includes('right') ? 'right: 0;' : 'left: 0;'}
        width: 350px;
        height: 500px;
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
        padding: 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      `;

			const headerTitle = document.createElement('div');
			headerTitle.innerHTML = `
        <div style="font-weight: 600; font-size: 16px;">Chat Support</div>
        <div style="font-size: 12px; opacity: 0.9;">Online now</div>
      `;

			const closeButton = document.createElement('button');
			closeButton.innerHTML = '✕';
			closeButton.style.cssText = `
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        padding: 4px;
      `;
			closeButton.onclick = toggleChat;

			chatHeader.appendChild(headerTitle);
			chatHeader.appendChild(closeButton);

			// Chat messages
			const messagesContainer = document.createElement('div');
			messagesContainer.id = 'plugrag-messages';
			messagesContainer.style.cssText = `
        flex: 1;
        padding: 16px;
        overflow-y: auto;
        background: #f9fafb;
      `;

			// Chat input
			const inputContainer = document.createElement('div');
			inputContainer.style.cssText = `
        padding: 16px;
        border-top: 1px solid #e5e7eb;
        background: white;
      `;

			const inputForm = document.createElement('form');
			inputForm.style.cssText = 'display: flex; gap: 8px;';

			const messageInput = document.createElement('input');
			messageInput.id = 'plugrag-message-input';
			messageInput.type = 'text';
			messageInput.placeholder = finalConfig.placeholder;
			messageInput.style.cssText = `
        flex: 1;
        padding: 10px 12px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        outline: none;
        font-size: 14px;
      `;
			messageInput.onfocus = () =>
				(messageInput.style.borderColor = finalConfig.color);
			messageInput.onblur = () => (messageInput.style.borderColor = '#d1d5db');

			const sendButton = document.createElement('button');
			sendButton.type = 'submit';
			sendButton.innerHTML = '→';
			sendButton.style.cssText = `
        padding: 10px 16px;
        background-color: ${finalConfig.color};
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 16px;
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
			chatButton.innerHTML = '💬';
		}
	}

	function addMessage(content, sender, isLoading = false) {
		const messagesContainer = document.getElementById('plugrag-messages');

		const messageDiv = document.createElement('div');
		messageDiv.style.cssText = `
      margin-bottom: 12px;
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
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.4;
      ${
				sender === 'user'
					? `background-color: ${finalConfig.color}; color: white; border-bottom-right-radius: 4px;`
					: 'background-color: white; color: #374151; border: 1px solid #e5e7eb; border-bottom-left-radius: 4px;'
			}
    `;

		if (isLoading) {
			messageBubble.innerHTML = `
        <div style="display: flex; gap: 4px; align-items: center;">
          <div style="width: 8px; height: 8px; background: #9ca3af; border-radius: 50%; animation: plugrag-pulse 1.4s ease-in-out infinite;"></div>
          <div style="width: 8px; height: 8px; background: #9ca3af; border-radius: 50%; animation: plugrag-pulse 1.4s ease-in-out 0.2s infinite;"></div>
          <div style="width: 8px; height: 8px; background: #9ca3af; border-radius: 50%; animation: plugrag-pulse 1.4s ease-in-out 0.4s infinite;"></div>
        </div>
      `;
			messageDiv.id = 'plugrag-loading-message';
		} else {
			messageBubble.textContent = content;
		}

		messageDiv.appendChild(messageBubble);
		messagesContainer.appendChild(messageDiv);
		messagesContainer.scrollTop = messagesContainer.scrollHeight;

		messages.push({ content, sender, timestamp: Date.now() });
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
					addMessage('I received your message but had trouble responding. Please try again.', 'bot');
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
