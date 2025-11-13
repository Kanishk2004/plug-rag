'use client';
import { useState, useEffect, useRef } from 'react';
import { ChatSession } from '@/lib/sessionUtils';

// Icons
const SendIcon = ({ className }) => (
	<svg
		className={className}
		fill="none"
		stroke="currentColor"
		viewBox="0 0 24 24">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={2}
			d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
		/>
	</svg>
);

const LoadingDots = ({ className }) => (
	<div className={`flex space-x-1 ${className}`}>
		<div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
		<div
			className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"
			style={{ animationDelay: '0.2s' }}></div>
		<div
			className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"
			style={{ animationDelay: '0.4s' }}></div>
	</div>
);

const ClearIcon = ({ className }) => (
	<svg
		className={className}
		fill="none"
		stroke="currentColor"
		viewBox="0 0 24 24">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={2}
			d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
		/>
	</svg>
);

const FileIcon = ({ className }) => (
	<svg
		className={className}
		fill="none"
		stroke="currentColor"
		viewBox="0 0 24 24">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={2}
			d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
		/>
	</svg>
);

/**
 * Component to display source documents with confidence scores
 */
const SourceDisplay = ({ sources = [] }) => {
	if (!sources || sources.length === 0) {
		return null;
	}

	return (
		<div className="mt-3 space-y-2">
			<div className="text-xs text-gray-400 font-medium">Sources:</div>
			<div className="space-y-1">
				{sources.map((source, index) => (
					<div
						key={index}
						className="flex items-center justify-between bg-gray-800/50 rounded px-2 py-1 text-xs">
						<div className="flex items-center space-x-2 flex-1 min-w-0">
							<FileIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
							<span className="text-gray-300 truncate">
								{source.fileName}
								{source.pageNumber && ` (Page ${source.pageNumber})`}
							</span>
						</div>
						{source.score && (
							<div className="flex items-center space-x-1 flex-shrink-0">
								<span className="text-gray-500">
									{(source.score * 100).toFixed(0)}%
								</span>
								<div
									className="w-2 h-2 rounded-full"
									style={{
										backgroundColor:
											source.score > 0.8
												? '#10b981'
												: source.score > 0.6
												? '#f59e0b'
												: '#ef4444',
									}}
								/>
							</div>
						)}
					</div>
				))}
			</div>
		</div>
	);
};

/**
 * Individual message bubble component
 */
const MessageBubble = ({ message, isUser, sources = [] }) => {
	return (
		<div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
			<div className={`max-w-[80%] ${isUser ? 'order-2' : 'order-1'}`}>
				<div
					className={`rounded-lg px-4 py-2 text-sm ${
						isUser
							? 'bg-orange-500 text-white'
							: 'bg-gray-800 text-gray-100 border border-gray-700'
					}`}>
					<div className="whitespace-pre-wrap break-words">{message}</div>

					{/* Show sources for assistant messages */}
					{!isUser && sources && sources.length > 0 && (
						<SourceDisplay sources={sources} />
					)}
				</div>

				<div
					className={`text-xs text-gray-500 mt-1 ${
						isUser ? 'text-right' : 'text-left'
					}`}>
					{new Date().toLocaleTimeString([], {
						hour: '2-digit',
						minute: '2-digit',
					})}
				</div>
			</div>
		</div>
	);
};

/**
 * Suggested questions component
 */
const SuggestedQuestions = ({
	questions = [],
	onQuestionClick,
	disabled = false,
}) => {
	if (!questions || questions.length === 0) {
		return null;
	}

	return (
		<div className="mb-4">
			<div className="text-xs text-gray-400 font-medium mb-2">
				Suggested questions:
			</div>
			<div className="space-y-2">
				{questions.map((question, index) => (
					<button
						key={index}
						onClick={() => onQuestionClick(question)}
						disabled={disabled}
						className="w-full text-left text-sm p-3 bg-gray-800/50 hover:bg-gray-800 disabled:hover:bg-gray-800/50 border border-gray-700 rounded-lg text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
						{question}
					</button>
				))}
			</div>
		</div>
	);
};

/**
 * Main chat interface component
 */
const ChatInterface = ({ botId, botName = 'Assistant' }) => {
	const [messages, setMessages] = useState([]);
	const [inputMessage, setInputMessage] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [isInitialLoading, setIsInitialLoading] = useState(true);
	const [error, setError] = useState(null);
	const [chatSession, setChatSession] = useState(null);

	const messagesEndRef = useRef(null);
	const inputRef = useRef(null);

	// Scroll to bottom of messages
	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	};

	useEffect(() => {
		scrollToBottom();
	}, [messages]);

	// Initialize chat session and load conversation data
	useEffect(() => {
		const initializeChat = async () => {
			try {
				setIsInitialLoading(true);
				setError(null);

				// Create new chat session (fresh session on each page load)
				const session = new ChatSession(botId);
				setChatSession(session);

				const sessionInfo = session.getSessionInfo();
				
				// Validate session has required properties
				if (!sessionInfo.sessionId || !sessionInfo.botId) {
					throw new Error('Invalid session created - missing required properties');
				}

				// For fresh sessions, we don't need to load history since it will be empty
				// Just set empty messages array
				setMessages([]);

			} catch (error) {
				console.error('Error initializing chat:', error);
				setError('Failed to initialize chat. Please refresh the page.');
			} finally {
				setIsInitialLoading(false);
			}
		};

		if (botId) {
			initializeChat();
		}
	}, [botId]);

	// Send message
	const sendMessage = async (messageText = null) => {
		const message = messageText || inputMessage.trim();

		if (!message || isLoading || !chatSession) {
			return;
		}

		setIsLoading(true);
		setError(null);

		// Add user message immediately
		const userMessage = {
			id: `user_${Date.now()}`,
			role: 'user',
			content: message,
			timestamp: new Date(),
		};

		setMessages((prev) => [...prev, userMessage]);
		setInputMessage('');

		try {
			// Use ChatSession to send message
			const response = await chatSession.sendMessage(message);

			if (response.success) {
				// Add assistant response with sources and metadata
				const assistantMessage = {
					id: response.data.messageId || `assistant_${Date.now()}`,
					role: 'assistant',
					content: response.data.response,
					timestamp: new Date(),
					sources: response.data.sources || [],
					responseTime: response.data.responseTime,
					tokensUsed: response.data.tokensUsed,
					hasRelevantContext: response.data.hasRelevantContext
				};

				setMessages((prev) => [...prev, assistantMessage]);
			} else {
				throw new Error(response.error || 'Failed to get response');
			}
		} catch (error) {
			console.error('Error sending message:', error);
			setError(error.message);

			// Add error message
			const errorMessage = {
				id: `error_${Date.now()}`,
				role: 'assistant',
				content: `Sorry, I encountered an error: ${error.message}. Please try again.`,
				timestamp: new Date(),
				sources: [],
			};

			setMessages((prev) => [...prev, errorMessage]);
		} finally {
			setIsLoading(false);
		}
	};

	// Clear conversation
	const clearConversation = async () => {
		if (!confirm('Are you sure you want to clear the conversation history?')) {
			return;
		}

		if (!chatSession) {
			setError('Chat session not initialized');
			return;
		}

		try {
			const response = await chatSession.clearHistory();

			if (response.success) {
				setMessages([]);
				setError(null);
			} else {
				throw new Error(response.error || 'Failed to clear conversation');
			}
		} catch (error) {
			console.error('Error clearing conversation:', error);
			setError('Failed to clear conversation. Please try again.');
		}
	};

	// Handle form submission
	const handleSubmit = (e) => {
		e.preventDefault();
		sendMessage();
	};

	// Handle suggested question click
	const handleQuestionClick = (question) => {
		if (isLoading) return;
		sendMessage(question);
	};

	// Suggested questions for initial conversation
	const suggestedQuestions = [
		"What can you help me with?",
		"Tell me about the uploaded documents",
		"How does this bot work?",
	];

	if (isInitialLoading) {
		return (
			<div className="h-full flex items-center justify-center">
				<div className="text-center">
					<LoadingDots className="mx-auto mb-2" />
					<p className="text-sm text-gray-400">Loading chat...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="h-full flex flex-col bg-gray-900">
			{/* Chat Header */}
			<div className="flex items-center justify-between p-4 border-b border-gray-800">
				<div>
					<h3 className="text-lg font-medium text-white">Test Chat</h3>
					<p className="text-sm text-gray-400">with {botName}</p>
				</div>

				<button
					onClick={clearConversation}
					className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
					title="Clear conversation">
					<ClearIcon className="w-5 h-5" />
				</button>
			</div>

			{/* Error Display */}
			{error && (
				<div className="mx-4 mt-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm">
					{error}
				</div>
			)}

			{/* Messages Area */}
			<div className="flex-1 overflow-y-auto p-4 space-y-4">
				{messages.length === 0 && !isLoading ? (
					<div className="text-center py-8">
						<div className="text-gray-400 mb-4">
							<p className="text-lg mb-2">👋 Hello!</p>
							<p className="text-sm">Start a conversation with {botName}.</p>
							<p className="text-xs text-gray-500 mt-2">
								This bot will answer based on uploaded documents.
							</p>
							{chatSession && (
								<p className="text-xs text-gray-600 mt-1">
									Session: {chatSession.sessionId.split('_')[1]}
								</p>
							)}
						</div>

						{/* Show suggested questions when no messages */}
						<SuggestedQuestions
							questions={suggestedQuestions}
							onQuestionClick={handleQuestionClick}
							disabled={isLoading}
						/>
					</div>
				) : (
					<>
						{messages.map((message) => (
							<MessageBubble
								key={message.id}
								message={message.content}
								isUser={message.role === 'user'}
								sources={message.sources}
							/>
						))}
					</>
				)}

				{/* Loading indicator */}
				{isLoading && (
					<div className="flex justify-start mb-4">
						<div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2">
							<LoadingDots />
							<div className="text-xs text-gray-500 mt-1">
								{botName} is thinking...
							</div>
						</div>
					</div>
				)}

				<div ref={messagesEndRef} />
			</div>

			{/* Input Area */}
			<div className="border-t border-gray-800 p-4">
				<form onSubmit={handleSubmit} className="flex space-x-2">
					<input
						ref={inputRef}
						type="text"
						value={inputMessage}
						onChange={(e) => setInputMessage(e.target.value)}
						placeholder={`Ask ${botName} a question...`}
						disabled={isLoading}
						className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
						maxLength={1000}
					/>
					<button
						type="submit"
						disabled={!inputMessage.trim() || isLoading}
						className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white p-2 rounded-lg transition-colors flex items-center justify-center">
						<SendIcon className="w-5 h-5" />
					</button>
				</form>

				<div className="flex items-center justify-between mt-2 text-xs text-gray-500">
					<span>{inputMessage.length}/1000</span>
					<span>Press Enter to send</span>
				</div>
			</div>
		</div>
	);
};

export default ChatInterface;
