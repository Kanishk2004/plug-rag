import React, { useState, useRef, useEffect } from 'react';
import { 
	ChatIcon, 
	XIcon, 
	LoadingSpinner, 
	FileIcon, 
	CheckIcon,
	WarningIcon,
	RefreshIcon
} from '@/components/ui/icons';

/**
 * ConversationDetail Component
 * 
 * Displays detailed view of a conversation including:
 * - Full message history with sources
 * - User information and session details
 * - Analytics and performance metrics
 * - Message search and navigation
 */
const ConversationDetail = ({
	conversation,
	analytics,
	userAgentInfo,
	botInfo,
	onClose,
	onDelete,
	onRefresh,
	isLoading = false,
	error = null
}) => {
	const [searchTerm, setSearchTerm] = useState('');
	const [filteredMessages, setFilteredMessages] = useState([]);
	const [selectedMessageIndex, setSelectedMessageIndex] = useState(-1);
	const messagesEndRef = useRef(null);
	const messageRefs = useRef([]);

	// Filter messages based on search term
	useEffect(() => {
		if (!conversation?.messages) {
			setFilteredMessages([]);
			return;
		}

		if (!searchTerm.trim()) {
			setFilteredMessages(conversation.messages);
			setSelectedMessageIndex(-1);
		} else {
			const filtered = conversation.messages.filter(msg =>
				msg.content.toLowerCase().includes(searchTerm.toLowerCase())
			);
			setFilteredMessages(filtered);
			setSelectedMessageIndex(-1);
		}
	}, [conversation?.messages, searchTerm]);

	// Scroll to bottom when conversation loads
	useEffect(() => {
		if (filteredMessages.length > 0 && !searchTerm) {
			scrollToBottom();
		}
	}, [filteredMessages, searchTerm]);

	// Scroll to bottom
	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	};

	// Scroll to specific message
	const scrollToMessage = (index) => {
		messageRefs.current[index]?.scrollIntoView({ 
			behavior: 'smooth', 
			block: 'center' 
		});
		setSelectedMessageIndex(index);
	};

	// Format timestamp
	const formatTimestamp = (timestamp) => {
		const date = new Date(timestamp);
		return date.toLocaleString();
	};

	// Format duration in milliseconds
	const formatDuration = (ms) => {
		if (ms < 1000) return `${ms}ms`;
		if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
		return `${(ms / 60000).toFixed(1)}m`;
	};

	// Handle delete conversation
	const handleDelete = () => {
		if (!conversation) return;
		
		const confirmed = confirm(
			`Are you sure you want to delete this conversation? This action cannot be undone.`
		);
		
		if (confirmed && onDelete) {
			onDelete(conversation.sessionId);
		}
	};

	// Search navigation
	const navigateSearch = (direction) => {
		if (filteredMessages.length === 0) return;
		
		let newIndex = selectedMessageIndex + direction;
		
		if (newIndex >= filteredMessages.length) {
			newIndex = 0;
		} else if (newIndex < 0) {
			newIndex = filteredMessages.length - 1;
		}
		
		// Find the index in the original messages array
		const originalIndex = conversation.messages.findIndex(
			msg => msg === filteredMessages[newIndex]
		);
		
		if (originalIndex >= 0) {
			scrollToMessage(originalIndex);
		}
	};

	// Loading state
	if (isLoading) {
		return (
			<div className="h-full bg-gray-900 rounded-lg border border-gray-800 flex items-center justify-center">
				<div className="text-center">
					<LoadingSpinner className="w-8 h-8 text-orange-400 mx-auto mb-2" />
					<p className="text-gray-400">Loading conversation...</p>
				</div>
			</div>
		);
	}

	// Error state
	if (error) {
		return (
			<div className="h-full bg-gray-900 rounded-lg border border-red-700 p-6">
				<div className="text-center">
					<WarningIcon className="w-12 h-12 text-red-400 mx-auto mb-3" />
					<h3 className="text-red-300 font-medium mb-2">Error Loading Conversation</h3>
					<p className="text-red-200 text-sm mb-4">{error}</p>
					<button
						onClick={onRefresh}
						className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
					>
						Try Again
					</button>
				</div>
			</div>
		);
	}

	// No conversation selected
	if (!conversation) {
		return (
			<div className="h-full bg-gray-900 rounded-lg border border-gray-800 flex items-center justify-center">
				<div className="text-center">
					<ChatIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
					<h3 className="text-gray-300 font-medium mb-2">No Conversation Selected</h3>
					<p className="text-gray-400 text-sm">
						Select a conversation from the list to view details
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="h-full bg-gray-900 rounded-lg border border-gray-800 flex flex-col">
			{/* Header */}
			<div className="border-b border-gray-800 p-4">
				<div className="flex items-center justify-between mb-3">
					<div className="flex items-center space-x-3">
						<div className={`p-2 rounded-full ${conversation.status === 'active' ? 'bg-green-500/20' : 'bg-gray-700'}`}>
							<ChatIcon className={`w-5 h-5 ${conversation.status === 'active' ? 'text-green-400' : 'text-gray-400'}`} />
						</div>
						<div>
							<h2 className="text-lg font-medium text-white">
								Conversation Details
							</h2>
							<p className="text-sm text-gray-400">
								Session {conversation.sessionId}
							</p>
						</div>
					</div>

					<div className="flex items-center space-x-2">
						<button
							onClick={onRefresh}
							className="p-2 text-gray-400 hover:text-gray-200 transition-colors"
							title="Refresh conversation"
						>
							<RefreshIcon className="w-4 h-4" />
						</button>
						<button
							onClick={handleDelete}
							className="p-2 text-gray-400 hover:text-red-400 transition-colors"
							title="Delete conversation"
						>
							<XIcon className="w-4 h-4" />
						</button>
						<button
							onClick={onClose}
							className="p-2 text-gray-400 hover:text-gray-200 transition-colors"
							title="Close details"
						>
							<XIcon className="w-4 h-4" />
						</button>
					</div>
				</div>

				{/* Search Bar */}
				<div className="flex items-center space-x-2">
					<input
						type="text"
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						placeholder="Search in messages..."
						className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
					/>
					{searchTerm && filteredMessages.length > 0 && (
						<div className="flex items-center space-x-1">
							<span className="text-xs text-gray-400">
								{filteredMessages.length} found
							</span>
							<button
								onClick={() => navigateSearch(-1)}
								className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
							>
								↑
							</button>
							<button
								onClick={() => navigateSearch(1)}
								className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
							>
								↓
							</button>
						</div>
					)}
				</div>
			</div>

			{/* Content Area - Responsive Layout */}
			<div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
				{/* Messages */}
				<div className="flex-1 flex flex-col">
					<div className="flex-1 overflow-y-auto p-4 space-y-4">
						{(searchTerm ? filteredMessages : conversation.messages).map((message, index) => {
							const originalIndex = searchTerm ? 
								conversation.messages.findIndex(msg => msg === message) : 
								index;
								
							const isHighlighted = originalIndex === selectedMessageIndex;
							
							return (
								<div
									key={message.id || index}
									ref={el => messageRefs.current[originalIndex] = el}
									className={`transition-all duration-200 ${
										isHighlighted ? 'ring-2 ring-orange-500 ring-opacity-50' : ''
									}`}
								>
									<div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
										<div className={`max-w-[85%] ${
											message.role === 'user'
												? 'bg-orange-500 text-white'
												: 'bg-gray-800 border border-gray-700 text-gray-100'
										} rounded-lg p-4`}>
											{/* Message Header */}
											<div className="flex items-center justify-between mb-2">
												<span className={`text-xs font-medium ${
													message.role === 'user' ? 'text-orange-100' : 'text-gray-400'
												}`}>
													{message.role === 'user' ? 'User' : botInfo?.name || 'Assistant'}
												</span>
												<span className={`text-xs ${
													message.role === 'user' ? 'text-orange-200' : 'text-gray-500'
												}`}>
													{formatTimestamp(message.timestamp)}
												</span>
											</div>

											{/* Message Content */}
											<div className="prose prose-sm max-w-none">
												<p className="whitespace-pre-wrap break-words">
													{message.content}
												</p>
											</div>

											{/* Assistant Message Metadata */}
											{message.role === 'assistant' && message.metadata && (
												<div className="mt-3 pt-3 border-t border-gray-700">
													{/* Performance Info */}
													<div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3 text-xs">
														{message.metadata.responseTime && (
															<div>
																<span className="text-gray-500">Response Time:</span>
																<span className="ml-1 text-gray-300">
																	{formatDuration(message.metadata.responseTime)}
																</span>
															</div>
														)}
														{message.metadata.tokens && (
															<div>
																<span className="text-gray-500">Tokens:</span>
																<span className="ml-1 text-orange-400">
																	{message.metadata.tokens}
																</span>
															</div>
														)}
														{message.metadata.model && (
															<div>
																<span className="text-gray-500">Model:</span>
																<span className="ml-1 text-gray-300">
																	{message.metadata.model}
																</span>
															</div>
														)}
													</div>

													{/* Context Status */}
													<div className="mb-3">
														<div className={`flex items-center space-x-2 text-xs px-2 py-1 rounded ${
															message.metadata.hasRelevantContext
																? 'bg-green-900/30 text-green-300 border border-green-700/30'
																: 'bg-yellow-900/30 text-yellow-300 border border-yellow-700/30'
														}`}>
															{message.metadata.hasRelevantContext ? (
																<CheckIcon className="w-3 h-3" />
															) : (
																<WarningIcon className="w-3 h-3" />
															)}
															<span>
																{message.metadata.hasRelevantContext 
																	? 'Used knowledge base' 
																	: 'No relevant context found'
																}
															</span>
														</div>
													</div>

													{/* Sources */}
													{message.metadata.sources && message.metadata.sources.length > 0 && (
														<div>
															<div className="text-xs text-gray-500 mb-2">
																Sources ({message.metadata.sources.length}):
															</div>
															<div className="space-y-2">
																{message.metadata.sources.map((source, idx) => {
																	// Handle both old and new source formats
																	const pageNumbers = source.pageNumbers || (source.pageNumber ? [source.pageNumber] : []);
																	const chunkCount = source.chunkCount || 1;
																	const relevanceScore = source.maxScore || source.score || 0;
																	
																	// Format page display
																	const formatPageNumbers = (pages) => {
																		if (!pages || pages.length === 0) return null;
																		if (pages.length === 1) return `Page ${pages[0]}`;
																		
																		// Check if pages are consecutive
																		const sortedPages = [...pages].sort((a, b) => a - b);
																		const isConsecutive = sortedPages.every((page, i) => 
																			i === 0 || page === sortedPages[i - 1] + 1
																		);
																		
																		if (isConsecutive && sortedPages.length > 2) {
																			return `Pages ${sortedPages[0]}-${sortedPages[sortedPages.length - 1]}`;
																		}
																		
																		// Show up to 3 pages, then ellipsis
																		if (sortedPages.length > 3) {
																			return `Pages ${sortedPages.slice(0, 3).join(', ')}...`;
																		}
																		
																		return `Pages ${sortedPages.join(', ')}`;
																	};
																	
																	return (
																		<div 
																			key={idx}
																			className="flex items-center space-x-2 text-xs p-2 bg-gray-900 rounded border border-gray-600"
																		>
																			<FileIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
																			<div className="flex-1 min-w-0">
																				<div className="font-medium text-gray-300 truncate">
																					{source.fileName}
																				</div>
																				{formatPageNumbers(pageNumbers) && (
																					<div className="text-gray-500">
																						{formatPageNumbers(pageNumbers)}
																					</div>
																				)}
																				{chunkCount > 1 && (
																					<div className="text-blue-400 text-xs">
																						{chunkCount} chunks used
																					</div>
																				)}
																			</div>
																			{relevanceScore > 0 && (
																				<div className="text-orange-400 font-mono">
																					{(relevanceScore * 100).toFixed(0)}%
																				</div>
																			)}
																		</div>
																	);
																})}
															</div>
														</div>
													)}
												</div>
											)}
										</div>
									</div>
								</div>
							);
						})}

						{/* Empty state */}
						{filteredMessages.length === 0 && searchTerm && (
							<div className="text-center py-8">
								<p className="text-gray-400">No messages found matching "{searchTerm}"</p>
							</div>
						)}

						<div ref={messagesEndRef} />
					</div>

					{/* Scroll to bottom button */}
					{conversation.messages && conversation.messages.length > 5 && (
						<div className="p-4 border-t border-gray-800">
							<button
								onClick={scrollToBottom}
								className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
							>
								Scroll to bottom
							</button>
						</div>
					)}
				</div>

				{/* Sidebar - Analytics and Info */}
				<div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-gray-800 p-4 space-y-6 overflow-y-auto">
					{/* Session Info */}
					<div>
						<h3 className="text-sm font-medium text-white mb-3">Session Information</h3>
						<div className="space-y-3 text-xs">
							<div className="grid grid-cols-2 gap-2">
								<div>
									<span className="text-gray-400">Status:</span>
									<div className={`mt-1 px-2 py-1 rounded text-center font-medium ${
										conversation.status === 'active' 
											? 'bg-green-900 text-green-200' 
											: 'bg-gray-700 text-gray-300'
									}`}>
										{conversation.status}
									</div>
								</div>
								<div>
									<span className="text-gray-400">Duration:</span>
									<div className="mt-1 text-white font-medium">
										{formatDuration(conversation.duration || 0)}
									</div>
								</div>
							</div>

							<div>
								<span className="text-gray-400">Started:</span>
								<div className="mt-1 text-white">
									{formatTimestamp(conversation.startedAt)}
								</div>
							</div>

							{conversation.lastActivityAt && (
								<div>
									<span className="text-gray-400">Last Activity:</span>
									<div className="mt-1 text-white">
										{formatTimestamp(conversation.lastActivityAt)}
									</div>
								</div>
							)}

							<div>
								<span className="text-gray-400">Domain:</span>
								<div className="mt-1 text-white font-mono break-all">
									{conversation.domain || 'Unknown'}
								</div>
							</div>

							{conversation.ipAddress && (
								<div>
									<span className="text-gray-400">IP Address:</span>
									<div className="mt-1 text-white font-mono">
										{conversation.ipAddress}
									</div>
								</div>
							)}

							{userAgentInfo && (
								<div>
									<span className="text-gray-400">Browser/Device:</span>
									<div className="mt-1 text-white">
										{userAgentInfo.browser} on {userAgentInfo.os}
									</div>
									<div className="text-gray-400">
										{userAgentInfo.device}
									</div>
								</div>
							)}
						</div>
					</div>

					{/* Analytics */}
					{analytics && (
						<div>
							<h3 className="text-sm font-medium text-white mb-3">Analytics</h3>
							<div className="grid grid-cols-2 gap-3 text-xs">
								<div className="text-center p-3 bg-gray-800 rounded">
									<div className="text-lg font-bold text-white">{analytics.totalMessages || 0}</div>
									<div className="text-gray-400">Messages</div>
								</div>
								<div className="text-center p-3 bg-gray-800 rounded">
									<div className="text-lg font-bold text-orange-400">
										{analytics.totalTokensUsed ? analytics.totalTokensUsed.toLocaleString() : 0}
									</div>
									<div className="text-gray-400">Tokens</div>
								</div>
								<div className="text-center p-3 bg-gray-800 rounded">
									<div className="text-lg font-bold text-blue-400">{analytics.userMessages || 0}</div>
									<div className="text-gray-400">User</div>
								</div>
								<div className="text-center p-3 bg-gray-800 rounded">
									<div className="text-lg font-bold text-green-400">{analytics.assistantMessages || 0}</div>
									<div className="text-gray-400">Assistant</div>
								</div>
								<div className="col-span-2 text-center p-3 bg-gray-800 rounded">
									<div className="text-lg font-bold text-purple-400">
										{analytics.averageResponseTime ? formatDuration(analytics.averageResponseTime) : 'N/A'}
									</div>
									<div className="text-gray-400">Avg Response Time</div>
								</div>
								{analytics.messagesWithContext !== undefined && (
									<div className="col-span-2 text-center p-3 bg-gray-800 rounded">
										<div className="text-lg font-bold text-green-400">
											{analytics.messagesWithContext}/{analytics.assistantMessages || 0}
										</div>
										<div className="text-gray-400">Used Knowledge Base</div>
									</div>
								)}
								{analytics.uniqueSources && (
									<div className="col-span-2 text-center p-3 bg-gray-800 rounded">
										<div className="text-lg font-bold text-yellow-400">{analytics.uniqueSources}</div>
										<div className="text-gray-400">Unique Sources</div>
									</div>
								)}
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default ConversationDetail;