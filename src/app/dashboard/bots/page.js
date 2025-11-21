'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useBots } from '@/hooks/useAPI';

export default function MyBots() {
	const [searchTerm, setSearchTerm] = useState('');
	const [statusFilter, setStatusFilter] = useState('all');
	const [currentPage, setCurrentPage] = useState(1);

	const { bots, loading, error, pagination, refetch } = useBots({
		page: currentPage,
		limit: 12,
		status: statusFilter,
		search: searchTerm, // Use server-side search
		autoRefresh: true,
		refreshInterval: 30000,
	});

	// Server-side search is handled by the API via the search parameter
	// No need for client-side filtering anymore

	if (error) {
		return (
			<DashboardLayout>
				<div className="space-y-8">
					<div className="bg-red-900 border border-red-700 rounded-lg p-6 text-center">
						<h2 className="text-lg font-medium text-red-100 mb-2">
							Error Loading Bots
						</h2>
						<p className="text-red-200 mb-4">{error}</p>
						<button
							onClick={refetch}
							className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors">
							Try Again
						</button>
					</div>
				</div>
			</DashboardLayout>
		);
	}

	return (
		<DashboardLayout>
			<div className="space-y-8">
				{/* Header */}
				<div className="flex justify-between items-center">
					<div>
						<h1 className="text-2xl font-bold text-white">My Bots</h1>
						<p className="mt-2 text-gray-200">
							Manage your chatbots and their settings
							{pagination.total > 0 && (
								<span className="text-gray-300">
									{' '}
									• {pagination.total} total bots
								</span>
							)}
						</p>
					</div>
					<Link
						href="/dashboard/create-bot"
						className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2">
						<Image
							src="/icons/plus.png"
							alt="Plus icon"
							width={20}
							height={20}
							className="brightness-0 invert"
						/>
						<span>Create New Bot</span>
					</Link>
				</div>

				{/* Filters and Search */}
				<div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
					<div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
						<div className="flex-1 max-w-md">
							<div className="relative">
								<SearchIcon className="w-5 h-5 text-gray-300 absolute left-3 top-1/2 transform -translate-y-1/2" />
								<input
									type="text"
									placeholder="Search bots..."
									value={searchTerm}
									onChange={(e) => {
										setSearchTerm(e.target.value);
										setCurrentPage(1); // Reset to first page when search changes
									}}
									className="w-full pl-10 pr-4 py-2 border border-gray-700 bg-gray-800 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
								/>
							</div>
						</div>
						<div className="flex items-center space-x-4">
							<select
								value={statusFilter}
								onChange={(e) => {
									setStatusFilter(e.target.value);
									setCurrentPage(1); // Reset to first page when filter changes
								}}
								className="px-4 py-2 border border-gray-700 bg-gray-800 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent">
								<option value="all">All Status</option>
								<option value="active">Active</option>
								<option value="inactive">Inactive</option>
							</select>
							<button
								onClick={refetch}
								disabled={loading}
								className="px-4 py-2 border border-gray-700 text-gray-200 rounded-lg hover:bg-gray-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2">
								<RefreshIcon
									className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
								/>
								<span>Refresh</span>
							</button>
						</div>
					</div>
				</div>

				{/* Loading State */}
				{loading && bots.length === 0 && (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						{Array.from({ length: 6 }).map((_, i) => (
							<BotCardSkeleton key={i} />
						))}
					</div>
				)}

				{/* Bots Grid */}
				{!loading && (
					<>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							{bots.map((bot) => (
								<BotCard key={bot.id} bot={bot} onRefresh={refetch} />
							))}
						</div>

						{/* Pagination */}
						{pagination.totalPages > 1 && (
							<div className="flex justify-center items-center space-x-4">
								<button
									onClick={() =>
										setCurrentPage((prev) => Math.max(1, prev - 1))
									}
									disabled={!pagination.hasPrevPage || loading}
									className="px-4 py-2 border border-gray-700 text-gray-200 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
									Previous
								</button>
								<span className="text-gray-300">
									Page {pagination.page} of {pagination.totalPages}
								</span>
								<button
									onClick={() =>
										setCurrentPage((prev) =>
											Math.min(pagination.totalPages, prev + 1)
										)
									}
									disabled={!pagination.hasNextPage || loading}
									className="px-4 py-2 border border-gray-700 text-gray-200 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
									Next
								</button>
							</div>
						)}
					</>
				)}

				{/* Empty State */}
				{!loading && bots.length === 0 && (
					<div className="bg-gray-900 rounded-lg border border-gray-800 p-12 text-center">
						<div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
							<BotsIcon className="w-8 h-8 text-gray-300" />
						</div>
						<h3 className="text-lg font-medium text-white mb-2">
							No bots found
						</h3>
						<p className="text-gray-700 mb-6">
							{searchTerm || statusFilter !== 'all'
								? 'Try adjusting your search or filters'
								: 'Get started by creating your first chatbot'}
						</p>
						{!searchTerm && statusFilter === 'all' && (
							<Link
								href="/dashboard/create-bot"
								className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium transition-colors inline-flex items-center space-x-2">
								<PlusIcon className="w-5 h-5" />
								<span>Create Your First Bot</span>
							</Link>
						)}
					</div>
				)}
			</div>
		</DashboardLayout>
	);
}

const BotCard = ({ bot, onRefresh }) => {
	const [isToggling, setIsToggling] = useState(false);

	const handleToggleStatus = async () => {
		setIsToggling(true);
		try {
			// We'll implement this when we have individual bot management
			console.log(`Toggling status for bot ${bot.id}`);
			// For now, just refresh the list
			if (onRefresh) {
				await onRefresh();
			}
		} catch (error) {
			console.error('Error toggling bot status:', error);
		} finally {
			setIsToggling(false);
		}
	};

	const formatDate = (dateString) => {
		try {
			return new Date(dateString).toLocaleDateString();
		} catch {
			return dateString;
		}
	};

	const getLastActiveText = (updatedAt) => {
		try {
			const now = new Date();
			const lastUpdate = new Date(updatedAt);
			const diffInMinutes = Math.floor((now - lastUpdate) / (1000 * 60));

			if (diffInMinutes < 60) {
				return `${diffInMinutes} minutes ago`;
			} else if (diffInMinutes < 1440) {
				const hours = Math.floor(diffInMinutes / 60);
				return `${hours} hour${hours > 1 ? 's' : ''} ago`;
			} else {
				const days = Math.floor(diffInMinutes / 1440);
				return `${days} day${days > 1 ? 's' : ''} ago`;
			}
		} catch {
			return 'Recently';
		}
	};

	return (
		<div className="bg-gray-900 rounded-lg border border-gray-800 p-6 hover:shadow-md transition-shadow">
			{/* Header */}
			<div className="flex justify-between items-start mb-4">
				<div className="flex-1">
					<h3 className="text-lg font-medium text-white mb-1 line-clamp-1">
						{bot.name}
					</h3>
					<p className="text-sm text-gray-200 line-clamp-2">
						{bot.description}
					</p>
				</div>
				<div className="ml-4">
					<span
						className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
							bot.status === 'active'
								? 'bg-green-400/20 text-green-400 border border-green-400/30'
								: 'bg-gray-600 text-gray-200'
						}`}>
						{bot.status}
					</span>
				</div>
			</div>

			{/* Stats */}
			<div className="grid grid-cols-2 gap-4 mb-4">
				<div className="text-center">
					<div className="flex items-center justify-center space-x-1 mb-1">
						<p className="text-2xl font-bold text-white">
							{bot.analytics?.totalMessages || bot.totalMessages || 0}
						</p>
						<div className="w-2 h-2 bg-green-400 rounded-full" title="Data synced across all pages"></div>
					</div>
					<p className="text-xs text-gray-300">Messages</p>
				</div>
				<div className="text-center">
					<div className="flex items-center justify-center space-x-1 mb-1">
						<p className="text-2xl font-bold text-white">{bot.fileCount || 0}</p>
						<div className="w-2 h-2 bg-green-400 rounded-full" title="Data synced across all pages"></div>
					</div>
					<p className="text-xs text-gray-300">Files</p>
				</div>
			</div>

			{/* Additional Stats */}
			<div className="grid grid-cols-2 gap-4 mb-4 text-center">
				<div>
					<div className="flex items-center justify-center space-x-1 mb-1">
						<p className="text-lg font-semibold text-orange-400">
							{(() => {
								const tokens = bot.analytics?.totalTokensUsed || bot.totalTokens || 0;
								if (tokens >= 1000) {
									return Math.floor(tokens / 1000) + 'K';
								} else {
									return tokens.toLocaleString();
								}
							})()}
						</p>
						<div className="w-2 h-2 bg-green-400 rounded-full" title="Data synced across all pages"></div>
					</div>
					<p className="text-xs text-gray-300">Tokens</p>
				</div>
				<div>
					<div className="flex items-center justify-center space-x-1 mb-1">
						<p className="text-lg font-semibold text-blue-400">
							{bot.analytics?.lastActiveAt || bot.lastActiveAt ? 'Active' : 'Inactive'}
						</p>
						<div className="w-2 h-2 bg-green-400 rounded-full" title="Data synced across all pages"></div>
					</div>
					<p className="text-xs text-gray-300">Status</p>
				</div>
			</div>

			{/* Last Active */}
			<div className="mb-6">
				<p className="text-sm text-gray-700">
					Last updated: {getLastActiveText(bot.updatedAt)}
				</p>
				<p className="text-xs text-gray-600">
					Created: {formatDate(bot.createdAt)}
				</p>
			</div>

			{/* Actions */}
			<div className="flex space-x-2">
				<Link
					href={`/dashboard/bots/${bot.id}`}
					className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-200 py-2 px-3 rounded-lg text-sm font-medium text-center transition-colors">
					Manage
				</Link>
				<Link
					href={`/dashboard/bots/${bot.id}/embed`}
					className="flex-1 bg-orange-100 hover:bg-orange-200 text-orange-700 py-2 px-3 rounded-lg text-sm font-medium text-center transition-colors">
					Embed
				</Link>
				<button
					onClick={handleToggleStatus}
					disabled={isToggling}
					className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
						bot.status === 'active'
							? 'bg-red-100 hover:bg-red-200 text-red-700'
							: 'bg-green-100 hover:bg-green-200 text-green-700'
					}`}>
					{isToggling ? '...' : bot.status === 'active' ? 'Disable' : 'Enable'}
				</button>
			</div>
		</div>
	);
};

const BotCardSkeleton = () => (
	<div className="bg-gray-900 rounded-lg border border-gray-800 p-6 animate-pulse">
		<div className="flex justify-between items-start mb-4">
			<div className="flex-1">
				<div className="h-5 bg-gray-700 rounded w-3/4 mb-2"></div>
				<div className="h-4 bg-gray-700 rounded w-full"></div>
			</div>
			<div className="ml-4">
				<div className="h-6 w-16 bg-gray-700 rounded-full"></div>
			</div>
		</div>
		<div className="grid grid-cols-2 gap-4 mb-4">
			<div className="text-center">
				<div className="h-8 bg-gray-700 rounded w-12 mx-auto mb-1"></div>
				<div className="h-3 bg-gray-700 rounded w-16 mx-auto"></div>
			</div>
			<div className="text-center">
				<div className="h-8 bg-gray-700 rounded w-8 mx-auto mb-1"></div>
				<div className="h-3 bg-gray-700 rounded w-12 mx-auto"></div>
			</div>
		</div>
		<div className="grid grid-cols-2 gap-4 mb-4">
			<div className="text-center">
				<div className="h-6 bg-gray-700 rounded w-10 mx-auto mb-1"></div>
				<div className="h-3 bg-gray-700 rounded w-16 mx-auto"></div>
			</div>
			<div className="text-center">
				<div className="h-6 bg-gray-700 rounded w-12 mx-auto mb-1"></div>
				<div className="h-3 bg-gray-700 rounded w-14 mx-auto"></div>
			</div>
		</div>
		<div className="mb-6">
			<div className="h-3 bg-gray-700 rounded w-32 mb-1"></div>
			<div className="h-3 bg-gray-700 rounded w-24"></div>
		</div>
		<div className="flex space-x-2">
			<div className="flex-1 h-8 bg-gray-700 rounded"></div>
			<div className="flex-1 h-8 bg-gray-700 rounded"></div>
			<div className="w-16 h-8 bg-gray-700 rounded"></div>
		</div>
	</div>
);

// Icons
const PlusIcon = ({ className }) => (
	<svg
		className={className}
		fill="none"
		viewBox="0 0 24 24"
		strokeWidth={1.5}
		stroke="currentColor">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M12 4.5v15m7.5-7.5h-15"
		/>
	</svg>
);

const SearchIcon = ({ className }) => (
	<svg
		className={className}
		fill="none"
		viewBox="0 0 24 24"
		strokeWidth={1.5}
		stroke="currentColor">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
		/>
	</svg>
);

const RefreshIcon = ({ className }) => (
	<svg
		className={className}
		fill="none"
		viewBox="0 0 24 24"
		strokeWidth={1.5}
		stroke="currentColor">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
		/>
	</svg>
);

const BotsIcon = ({ className }) => (
	<svg
		className={className}
		fill="none"
		viewBox="0 0 24 24"
		strokeWidth={1.5}
		stroke="currentColor">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-10.5 3.75H7.5m9-6.75h.008v.008H16.5V7.5ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z"
		/>
	</svg>
);
