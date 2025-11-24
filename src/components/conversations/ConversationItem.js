import React from 'react';
import { ChatIcon, XIcon, LoadingSpinner } from '@/components/ui/icons';

/**
 * ConversationItem Component
 * 
 * Displays a conversation card in the conversations list
 * Shows conversation summary, metadata, and quick actions
 */
const ConversationItem = ({
	conversation,
	onSelect,
	onDelete,
	isSelected = false,
	isDeleting = false,
	showDeleteButton = true
}) => {
	// Format timestamp for display
	const formatTimestamp = (timestamp) => {
		const date = new Date(timestamp);
		const now = new Date();
		const diffInHours = (now - date) / (1000 * 60 * 60);
		
		if (diffInHours < 1) {
			const minutes = Math.floor(diffInHours * 60);
			return `${minutes}m ago`;
		} else if (diffInHours < 24) {
			const hours = Math.floor(diffInHours);
			return `${hours}h ago`;
		} else if (diffInHours < 168) {
			const days = Math.floor(diffInHours / 24);
			return `${days}d ago`;
		} else {
			return date.toLocaleDateString();
		}
	};

	// Format conversation duration
	const formatDuration = (startTime, endTime) => {
		const duration = new Date(endTime) - new Date(startTime);
		const minutes = Math.floor(duration / (1000 * 60));
		const hours = Math.floor(minutes / 60);
		
		if (hours > 0) {
			return `${hours}h ${minutes % 60}m`;
		} else if (minutes > 0) {
			return `${minutes}m`;
		} else {
			return '< 1m';
		}
	};

	// Extract domain from URL or use as-is if it's already a domain
	const formatDomain = (domain) => {
		if (!domain || domain === 'unknown') return 'Unknown';
		try {
			const url = domain.startsWith('http') ? new URL(domain) : new URL(`https://${domain}`);
			return url.hostname;
		} catch {
			return domain;
		}
	};

	// Get browser info from user agent
	const getBrowserInfo = (userAgent) => {
		if (!userAgent) return 'Unknown';
		const ua = userAgent.toLowerCase();
		
		if (ua.includes('chrome')) return 'Chrome';
		if (ua.includes('firefox')) return 'Firefox';
		if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari';
		if (ua.includes('edge')) return 'Edge';
		if (ua.includes('opera')) return 'Opera';
		
		return 'Unknown';
	};

	// Get preview of first user message
	const getMessagePreview = (firstMessage) => {
		if (!firstMessage) return 'No messages';
		
		const content = firstMessage.content || '';
		const maxLength = 80;
		
		if (content.length <= maxLength) {
			return content;
		}
		
		return content.substring(0, maxLength) + '...';
	};

	// Handle delete with confirmation
	const handleDelete = (e) => {
		e.stopPropagation(); // Prevent triggering onSelect
		
		if (isDeleting) return;
		
		const confirmed = confirm(
			`Are you sure you want to delete this conversation? This action cannot be undone.`
		);
		
		if (confirmed && onDelete) {
			onDelete(conversation.sessionId);
		}
	};

	return (
		<div
			className={`
				bg-gray-900 border rounded-lg p-4 cursor-pointer transition-all duration-200 hover:border-gray-600
				${isSelected ? 'border-orange-500 bg-orange-500/5' : 'border-gray-800'}
				${isDeleting ? 'opacity-50' : ''}
			`}
			onClick={() => !isDeleting && onSelect && onSelect(conversation)}
		>
			{/* Header */}
			<div className="flex items-start justify-between mb-3">
				<div className="flex items-center space-x-2 flex-1">
					<div className={`p-2 rounded-full ${conversation.status === 'active' ? 'bg-green-500/20' : 'bg-gray-700'}`}>
						<ChatIcon className={`w-4 h-4 ${conversation.status === 'active' ? 'text-green-400' : 'text-gray-400'}`} />
					</div>
					
					<div className="flex-1 min-w-0">
						<div className="flex items-center space-x-2">
							<span className="text-sm font-medium text-white">
								Session {conversation.sessionId.slice(-8)}
							</span>
							<span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
								conversation.status === 'active' 
									? 'bg-green-900 text-green-200' 
									: 'bg-gray-700 text-gray-300'
							}`}>
								{conversation.status}
							</span>
						</div>
						
						<div className="flex items-center space-x-3 mt-1 text-xs text-gray-400">
							<span>{formatTimestamp(conversation.createdAt)}</span>
							{conversation.lastMessageAt && conversation.createdAt !== conversation.lastMessageAt && (
								<span>•</span>
							)}
							{conversation.lastMessageAt && conversation.createdAt !== conversation.lastMessageAt && (
								<span>Last: {formatTimestamp(conversation.lastMessageAt)}</span>
							)}
						</div>
					</div>
				</div>

				{/* Delete Button */}
				{showDeleteButton && (
					<button
						onClick={handleDelete}
						disabled={isDeleting}
						className="p-1 text-gray-500 hover:text-red-400 transition-colors disabled:cursor-not-allowed"
						title="Delete conversation"
					>
						{isDeleting ? (
							<LoadingSpinner className="w-4 h-4" />
						) : (
							<XIcon className="w-4 h-4" />
						)}
					</button>
				)}
			</div>

			{/* Message Preview */}
			<div className="mb-3">
				<p className="text-sm text-gray-300 leading-relaxed">
					{getMessagePreview(conversation.firstMessage)}
				</p>
			</div>

			{/* Stats */}
			<div className="grid grid-cols-3 gap-3 mb-3 text-xs">
				<div className="text-center">
					<div className="text-white font-medium">{conversation.totalMessages || 0}</div>
					<div className="text-gray-400">Messages</div>
				</div>
				<div className="text-center">
					<div className="text-orange-400 font-medium">
						{(() => {
							const tokens = conversation.totalTokens || 0;
							if (tokens >= 1000) {
								return Math.floor(tokens / 1000) + 'K';
							}
							return tokens.toLocaleString();
						})()}
					</div>
					<div className="text-gray-400">Tokens</div>
				</div>
				<div className="text-center">
					<div className="text-white font-medium">
						{conversation.lastMessageAt && conversation.createdAt 
							? formatDuration(conversation.createdAt, conversation.lastMessageAt)
							: '< 1m'
						}
					</div>
					<div className="text-gray-400">Duration</div>
				</div>
			</div>

			{/* User & Source Info */}
			<div className="border-t border-gray-800 pt-3 space-y-2">
				<div className="flex items-center justify-between text-xs">
					<div className="flex items-center space-x-2">
						<span className="text-gray-400">Domain:</span>
						<span className="text-gray-300 font-mono">
							{formatDomain(conversation.domain)}
						</span>
					</div>
					<div className="flex items-center space-x-2">
						<span className="text-gray-400">Browser:</span>
						<span className="text-gray-300">
							{getBrowserInfo(conversation.userAgent)}
						</span>
					</div>
				</div>

				{conversation.ipAddress && (
					<div className="flex items-center justify-between text-xs">
						<div className="flex items-center space-x-2">
							<span className="text-gray-400">IP:</span>
							<span className="text-gray-300 font-mono text-xs">
								{conversation.ipAddress}
							</span>
						</div>
						{conversation.userFingerprint && (
							<div className="flex items-center space-x-2">
								<span className="text-gray-400">Fingerprint:</span>
								<span className="text-gray-300 font-mono text-xs">
									{conversation.userFingerprint.slice(0, 8)}...
								</span>
							</div>
						)}
					</div>
				)}

				{conversation.referrer && conversation.referrer !== 'unknown' && (
					<div className="text-xs">
						<span className="text-gray-400">Referrer: </span>
						<span className="text-gray-300 break-all">
							{conversation.referrer.length > 50 
								? conversation.referrer.substring(0, 50) + '...'
								: conversation.referrer
							}
						</span>
					</div>
				)}
			</div>

			{/* Last Message Preview (if different from first) */}
			{conversation.lastMessage && 
			 conversation.totalMessages > 1 && 
			 conversation.lastMessage.content !== conversation.firstMessage?.content && (
				<div className="border-t border-gray-800 mt-3 pt-3">
					<div className="text-xs text-gray-400 mb-1">Latest message:</div>
					<p className="text-xs text-gray-300 italic">
						{conversation.lastMessage.role === 'user' ? '"' : ''}
						{getMessagePreview(conversation.lastMessage)}
						{conversation.lastMessage.role === 'user' ? '"' : ''}
					</p>
				</div>
			)}
		</div>
	);
};

export default ConversationItem;