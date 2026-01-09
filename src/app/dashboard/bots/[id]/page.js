'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import BotDetailSkeleton from '@/components/ui/BotDetailSkeleton';
import { useBot } from '@/hooks/useBot';
import { useNotification } from '@/hooks/useNotification';
import { useApiKeyStatus } from '@/hooks/useApiKeyStatus';
import OverviewTab from '@/components/dashboard/botDetail/tabs/OverviewTab';
import ConversationsTab from '@/components/dashboard/botDetail/tabs/ConversationsTab';
import APIConfigTab from '@/components/dashboard/botDetail/tabs/APIConfigTab';
import ChatTab from '@/components/dashboard/botDetail/tabs/ChatTab';

export default function BotDetail({ params }) {
	const router = useRouter();
	const [botId, setBotId] = useState(null);
	const [activeTab, setActiveTab] = useState('overview');

	// Handle async params in Next.js 15
	useEffect(() => {
		const resolveBotId = async () => {
			const resolvedParams = await params;
			setBotId(resolvedParams.id);
		};
		resolveBotId();
	}, [params]);

	// Custom hooks
	const {
		bot,
		loading: botLoading,
		error: botError,
		updating,
		updateBot,
		toggleStatus,
		deleteBot,
	} = useBot(botId);

	const { notification, showNotification } = useNotification();
	const { status: apiKeyStatus, refresh: refreshApiKeyStatus } =
		useApiKeyStatus(botId);

	// Bot editing state
	const [isEditing, setIsEditing] = useState(false);
	const [editForm, setEditForm] = useState({
		name: '',
		description: '',
	});

	// Update form when bot data loads
	useEffect(() => {
		if (bot) {
			setEditForm({
				name: bot.name || '',
				description: bot.description || '',
			});
		}
	}, [bot]);

	// Handle API key updates
	const handleApiKeyUpdate = () => {
		// Refresh API key status using the hook's refresh function
		refreshApiKeyStatus();
	};

	const handleEdit = () => {
		setIsEditing(true);
	};

	const handleSave = async () => {
		if (!editForm.name.trim()) {
			showNotification('Bot name is required', 'error');
			return;
		}

		const result = await updateBot({
			name: editForm.name.trim(),
			description: editForm.description.trim(),
		});

		if (result.success) {
			setIsEditing(false);
			showNotification('Bot updated successfully');
		} else {
			showNotification(result.error || 'Failed to update bot', 'error');
		}
	};

	const handleCancel = () => {
		setIsEditing(false);
		if (bot) {
			setEditForm({
				name: bot.name || '',
				description: bot.description || '',
			});
		}
	};

	const handleToggleStatus = async () => {
		const result = await toggleStatus();
		if (result.success) {
			showNotification(
				`Bot ${
					result.bot.status === 'active' ? 'enabled' : 'disabled'
				} successfully`
			);
		} else {
			showNotification(result.error || 'Failed to update bot status', 'error');
		}
	};

	const handleDeleteBot = async () => {
		if (!bot) return;

		const confirmed = confirm(
			`Are you sure you want to delete "${bot.name}"? This action cannot be undone and will delete all associated files and chat data.`
		);

		if (!confirmed) return;

		const result = await deleteBot();
		if (result.success) {
			showNotification(
				`${bot.name} and all associated data deleted successfully`
			);
			// Redirect to bots list after successful deletion
			setTimeout(() => {
				router.push('/dashboard/bots');
			}, 2000);
		} else {
			showNotification(result.error || 'Failed to delete bot', 'error');
		}
	};

	// Show loading while resolving botId
	if (!botId) {
		return <BotDetailSkeleton />;
	}

	// Show loading skeleton while data is loading
	if (botLoading) {
		return <BotDetailSkeleton />;
	}

	// Error states
	if (botError) {
		return (
			<DashboardLayout>
				<div className="max-w-6xl mx-auto">
					<div className="bg-red-900 border border-red-700 rounded-lg p-6 text-center">
						<h2 className="text-lg font-medium text-red-100 mb-2">
							Error Loading Bot
						</h2>
						<p className="text-red-200 mb-4">{botError}</p>
						<Link
							href="/dashboard/bots"
							className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors">
							Back to Bots
						</Link>
					</div>
				</div>
			</DashboardLayout>
		);
	}

	// Loading state
	if (botLoading) {
		return (
			<DashboardLayout>
				<div className="max-w-6xl mx-auto">
					<BotDetailSkeleton />
				</div>
			</DashboardLayout>
		);
	}

	if (!bot) {
		return (
			<DashboardLayout>
				<div className="max-w-6xl mx-auto">
					<div className="bg-gray-900 border border-gray-800 rounded-lg p-6 text-center">
						<h2 className="text-lg font-medium text-white mb-2">
							Bot Not Found
						</h2>
						<p className="text-gray-200 mb-4">
							The bot you&apos;re looking for doesn&apos;t exist or you
							don&apos;t have access to it.
						</p>
						<Link
							href="/dashboard/bots"
							className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-colors">
							Back to Bots
						</Link>
					</div>
				</div>
			</DashboardLayout>
		);
	}

	return (
		<DashboardLayout>
			<div className="max-w-6xl mx-auto space-y-8">
				{/* Notification */}
				{notification && (
					<div
						className={`rounded-lg p-4 ${
							notification.type === 'error'
								? 'bg-red-900 border border-red-700 text-red-100'
								: notification.type === 'warning'
								? 'bg-yellow-900 border border-yellow-700 text-yellow-100'
								: 'bg-green-900 border border-green-700 text-green-100'
						}`}>
						{notification.message}
					</div>
				)}

				{/* Header */}
				<div className="flex justify-between items-start">
					<div>
						<div className="flex items-center space-x-2 mb-2">
							<Link
								href="/dashboard/bots"
								className="text-gray-300 hover:text-gray-200 transition-colors">
								← Back to Bots
							</Link>
						</div>
						{isEditing ? (
							<div className="space-y-2">
								<input
									type="text"
									value={editForm.name}
									onChange={(e) =>
										setEditForm((prev) => ({ ...prev, name: e.target.value }))
									}
									className="text-2xl font-bold text-white bg-gray-800 border-b-2 border-orange-500 focus:outline-none max-w-md"
									placeholder="Bot name"
								/>
								<textarea
									value={editForm.description}
									onChange={(e) =>
										setEditForm((prev) => ({
											...prev,
											description: e.target.value,
										}))
									}
									className="text-gray-200 bg-gray-800 border border-gray-700 rounded px-3 py-2 w-full max-w-2xl focus:outline-none focus:border-orange-500"
									rows="2"
									placeholder="Bot description"
								/>
							</div>
						) : (
							<>
								<h1 className="text-2xl font-bold text-white">{bot.name}</h1>
								<p className="mt-2 text-gray-200">{bot.description}</p>
							</>
						)}
					</div>

					<div className="flex items-center space-x-3">
						<span
							className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
								bot.status === 'active'
									? 'bg-green-400/20 text-green-400 border border-green-400/30'
									: 'bg-gray-600 text-gray-200'
							}`}>
							{bot.status}
						</span>

						{isEditing ? (
							<div className="flex space-x-2">
								<button
									onClick={handleSave}
									disabled={updating}
									className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
									{updating ? 'Saving...' : 'Save'}
								</button>
								<button
									onClick={handleCancel}
									className="px-4 py-2 border border-gray-700 text-gray-200 rounded-lg hover:bg-gray-700 font-medium transition-colors">
									Cancel
								</button>
							</div>
						) : (
							<button
								onClick={handleEdit}
								className="px-4 py-2 border border-gray-700 text-gray-200 rounded-lg hover:bg-gray-700 font-medium transition-colors">
								Edit
							</button>
						)}
					</div>
				</div>

				{/* Tab Navigation */}
				<div className="border-b border-gray-800">
					<nav className="flex space-x-8">
						<button
							onClick={() => setActiveTab('overview')}
							className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
								activeTab === 'overview'
									? 'border-orange-500 text-orange-400'
									: 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-700'
							}`}>
							Overview & Files
						</button>
						<button
							onClick={() => setActiveTab('conversations')}
							className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
								activeTab === 'conversations'
									? 'border-orange-500 text-orange-400'
									: 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-700'
							}`}>
							Conversations
						</button>
						<button
							onClick={() => setActiveTab('api-config')}
							className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
								activeTab === 'api-config'
									? 'border-orange-500 text-orange-400'
									: 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-700'
							}`}>
							API Configuration
						</button>
						<button
							onClick={() => setActiveTab('chat')}
							className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
								activeTab === 'chat'
									? 'border-orange-500 text-orange-400'
									: 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-700'
							}`}>
							Test Chat
						</button>
					</nav>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
					{/* Render Tab Components */}
					{activeTab === 'overview' && (
						<OverviewTab
							bot={bot}
							apiKeyStatus={apiKeyStatus}
							showNotification={showNotification}
							onBotUpdate={() => {
								/* Bot data will auto-refresh via useBot hook */
							}}
							onToggleStatus={handleToggleStatus}
							onDeleteBot={handleDeleteBot}
							onNavigateToApiConfig={() => setActiveTab('api-config')}
						/>
					)}

					{activeTab === 'conversations' && (
						<ConversationsTab
							botId={botId}
							bot={bot}
							showNotification={showNotification}
						/>
					)}

					{activeTab === 'api-config' && (
						<APIConfigTab
							botId={botId}
							apiKeyStatus={apiKeyStatus}
							onApiKeyUpdate={handleApiKeyUpdate}
							onNavigateToOverview={() => setActiveTab('overview')}
						/>
					)}

					{activeTab === 'chat' && (
						<ChatTab
							bot={bot}
							apiKeyStatus={apiKeyStatus}
							onNavigateToApiConfig={() => setActiveTab('api-config')}
						/>
					)}
				</div>
			</div>
		</DashboardLayout>
	);
}
