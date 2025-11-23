import { useState } from 'react';
import Link from 'next/link';

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
					</div>
					<p className="text-xs text-gray-300">Messages</p>
				</div>
				<div className="text-center">
					<div className="flex items-center justify-center space-x-1 mb-1">
						<p className="text-2xl font-bold text-white">
							{bot.fileCount || 0}
						</p>
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
								const tokens =
									bot.analytics?.totalTokensUsed || bot.totalTokens || 0;
								if (tokens >= 1000) {
									return Math.floor(tokens / 1000) + 'K';
								} else {
									return tokens.toLocaleString();
								}
							})()}
						</p>
					</div>
					<p className="text-xs text-gray-300">Tokens</p>
				</div>
				<div>
					<div className="flex items-center justify-center space-x-1 mb-1">
						<p className="text-lg font-semibold text-blue-400">
							{bot.analytics?.lastActiveAt || bot.lastActiveAt
								? 'Active'
								: 'Inactive'}
						</p>
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

export default BotCard;
