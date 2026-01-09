import { useState } from 'react';
import { LoadingSpinner, RefreshIcon, ChatIcon } from '@/components/ui/icons';
import { useConversations } from '@/hooks/useConversations';
import ConversationItem from '@/components/conversations/ConversationItem';
import ConversationDetail from '@/components/conversations/ConversationDetail';

/**
 * Conversations Tab Component - View and manage bot conversations
 * @param {Object} props
 * @param {string} props.botId - Bot ID
 * @param {Object} props.bot - Bot data
 * @param {Function} props.showNotification - Notification callback
 */
export default function ConversationsTab({ botId, bot, showNotification }) {
	const {
		conversations,
		pagination,
		statistics: conversationStats,
		filters,
		loading: conversationsLoading,
		error: conversationsError,
		processingConversations,
		refresh: refreshConversations,
		deleteConversation,
		getConversationDetail,
		loadNextPage,
		loadPreviousPage,
		resetFilters,
		searchConversations,
		filterByStatus,
		filterByDateRange,
	} = useConversations(botId);

	// Conversation detail state
	const [selectedConversation, setSelectedConversation] = useState(null);
	const [conversationDetail, setConversationDetail] = useState(null);
	const [conversationDetailLoading, setConversationDetailLoading] =
		useState(false);
	const [conversationDetailError, setConversationDetailError] = useState(null);

	// Helper function to handle conversation selection and detail loading
	const handleConversationSelect = async (conversation) => {
		setSelectedConversation(conversation);
		setConversationDetailLoading(true);
		setConversationDetailError(null);

		try {
			const detail = await getConversationDetail(conversation.sessionId);
			setConversationDetail(detail);
		} catch (error) {
			setConversationDetailError(error.message);
		} finally {
			setConversationDetailLoading(false);
		}
	};

	// Helper function to handle conversation deletion
	const handleConversationDelete = async (sessionId) => {
		const result = await deleteConversation(sessionId);
		if (result.success) {
			showNotification('Conversation deleted successfully');
			// Clear detail view if this conversation was selected
			if (selectedConversation?.sessionId === sessionId) {
				setSelectedConversation(null);
				setConversationDetail(null);
			}
		} else {
			showNotification(
				result.error || 'Failed to delete conversation',
				'error'
			);
		}
	};

	// Helper function to refresh conversation detail
	const handleConversationDetailRefresh = async () => {
		if (!selectedConversation) return;
		setConversationDetailLoading(true);
		setConversationDetailError(null);

		try {
			const detail = await getConversationDetail(
				selectedConversation.sessionId
			);
			setConversationDetail(detail);
		} catch (error) {
			setConversationDetailError(error.message);
		} finally {
			setConversationDetailLoading(false);
		}
	};

	return (
		<div className="lg:col-span-12 space-y-6">
			{/* Conversations Header and Stats */}
			<div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-lg font-medium text-white">Bot Conversations</h2>
					<div className="flex items-center space-x-3">
						<button
							onClick={refreshConversations}
							disabled={conversationsLoading}
							className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2">
							{conversationsLoading ? (
								<LoadingSpinner className="w-4 h-4" />
							) : (
								<RefreshIcon className="w-4 h-4" />
							)}
							<span>Refresh</span>
						</button>
						<button
							onClick={resetFilters}
							className="px-3 py-2 border border-gray-700 text-gray-300 hover:bg-gray-800 text-sm rounded-lg transition-colors">
							Clear Filters
						</button>
					</div>
				</div>

				{/* Conversation Statistics */}
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
					<div className="text-center">
						<div className="text-2xl font-bold text-white">
							{conversationStats?.totalConversations || 0}
						</div>
						<div className="text-xs text-gray-300">Total Conversations</div>
					</div>
					<div className="text-center">
						<div className="text-2xl font-bold text-green-400">
							{conversationStats?.activeConversations || 0}
						</div>
						<div className="text-xs text-gray-300">Active</div>
					</div>
					<div className="text-center">
						<div className="text-2xl font-bold text-blue-400">
							{conversationStats?.totalMessages || 0}
						</div>
						<div className="text-xs text-gray-300">Total Messages</div>
					</div>
					<div className="text-center">
						<div className="text-2xl font-bold text-orange-400">
							{(() => {
								const avg = conversationStats?.avgMessagesPerConversation || 0;
								return avg.toFixed(1);
							})()}
						</div>
						<div className="text-xs text-gray-300">Avg Messages</div>
					</div>
				</div>

				{/* Search and Filters */}
				<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
					<div className="md:col-span-2">
						<input
							type="text"
							placeholder="Search messages..."
							value={filters.search}
							onChange={(e) => searchConversations(e.target.value)}
							className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
						/>
					</div>
					<div>
						<select
							value={filters.status}
							onChange={(e) => filterByStatus(e.target.value)}
							className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500">
							<option value="all">All Status</option>
							<option value="active">Active</option>
							<option value="ended">Ended</option>
						</select>
					</div>
					<div>
						<input
							type="date"
							placeholder="From date"
							value={filters.dateFrom || ''}
							onChange={(e) =>
								filterByDateRange(e.target.value, filters.dateTo)
							}
							className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
						/>
					</div>
				</div>
			</div>

			{/* Conversations Content */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[800px]">
				{/* Conversations List */}
				<div className="lg:col-span-1 bg-gray-900 rounded-lg border border-gray-800 flex flex-col">
					<div className="border-b border-gray-800 p-4">
						<h3 className="text-sm font-medium text-white">
							Conversations ({pagination.totalCount || 0})
						</h3>
					</div>

					<div className="flex-1 overflow-y-auto p-4 space-y-3">
						{conversationsLoading && conversations.length === 0 && (
							<div className="text-center py-8">
								<LoadingSpinner className="w-6 h-6 text-orange-400 mx-auto mb-2" />
								<p className="text-gray-400 text-sm">
									Loading conversations...
								</p>
							</div>
						)}

						{conversationsError && (
							<div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
								<p className="text-red-300 text-sm">{conversationsError}</p>
							</div>
						)}

						{conversations.length === 0 &&
							!conversationsLoading &&
							!conversationsError && (
								<div className="text-center py-8">
									<ChatIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
									<p className="text-gray-400">No conversations yet</p>
									<p className="text-gray-500 text-sm mt-1">
										Conversations will appear here when users interact with your
										bot
									</p>
								</div>
							)}

						{conversations.map((conversation) => (
							<ConversationItem
								key={conversation.sessionId}
								conversation={conversation}
								onSelect={handleConversationSelect}
								onDelete={(sessionId) => handleConversationDelete(sessionId)}
								isSelected={
									selectedConversation?.sessionId === conversation.sessionId
								}
								isDeleting={processingConversations.has(conversation.sessionId)}
							/>
						))}
					</div>

					{/* Pagination */}
					{pagination && pagination.totalPages > 1 && (
						<div className="border-t border-gray-800 p-4">
							<div className="flex items-center justify-between text-sm">
								<div className="text-gray-400">
									Page {pagination.currentPage} of {pagination.totalPages}
								</div>
								<div className="flex space-x-2">
									<button
										onClick={loadPreviousPage}
										disabled={!pagination.hasPrevPage || conversationsLoading}
										className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
										Prev
									</button>
									<button
										onClick={loadNextPage}
										disabled={!pagination.hasNextPage || conversationsLoading}
										className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
										Next
									</button>
								</div>
							</div>
						</div>
					)}
				</div>

				{/* Conversation Detail */}
				<div className="lg:col-span-2">
					<ConversationDetail
						conversation={conversationDetail?.conversation}
						analytics={conversationDetail?.analytics}
						userAgentInfo={conversationDetail?.userAgentInfo}
						botInfo={
							conversationDetail?.botInfo || {
								name: bot?.name,
								id: bot?.id,
							}
						}
						onClose={() => {
							setSelectedConversation(null);
							setConversationDetail(null);
						}}
						onDelete={(sessionId) => handleConversationDelete(sessionId)}
						onRefresh={handleConversationDetailRefresh}
						isLoading={conversationDetailLoading}
						error={conversationDetailError}
					/>
				</div>
			</div>
		</div>
	);
}
