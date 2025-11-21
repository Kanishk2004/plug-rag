'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useBots } from '@/hooks/useAPI';

// Component imports
import BotCard from '@/components/dashboard/BotCard';
import BotCardSkeleton from '@/components/ui/BotCardSkeleton';

// Icon imports
import { PlusIcon, SearchIcon, RefreshIcon, BotsIcon } from '@/components/ui/icons';

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






