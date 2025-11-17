'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import FileUpload from '@/components/FileUpload';
import ChatInterface from '@/components/ChatInterface';
import APIKeyManager from '@/components/APIKeyManager';
import { useBot, useBotFiles } from '@/hooks/useAPI';
import { fileAPI } from '@/lib/api';

// Icons (you can replace with your preferred icon library)
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

const XIcon = ({ className }) => (
	<svg
		className={className}
		fill="none"
		stroke="currentColor"
		viewBox="0 0 24 24">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={2}
			d="M6 18L18 6M6 6l12 12"
		/>
	</svg>
);

const LoadingSpinner = ({ className }) => (
	<svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
		<circle
			cx="12"
			cy="12"
			r="10"
			stroke="currentColor"
			strokeWidth="4"
			className="opacity-25"></circle>
		<path
			fill="currentColor"
			className="opacity-75"
			d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
	</svg>
);

// File Item Component
const FileItem = ({ file, isProcessing, onDelete }) => {
	const getStatusColor = (status) => {
		switch (status) {
			case 'completed':
				return 'text-green-400';
			case 'processing':
				return 'text-orange-400';
			case 'failed':
				return 'text-red-400';
			default:
				return 'text-gray-400';
		}
	};

	const getStatusText = (status) => {
		switch (status) {
			case 'completed':
				return 'Completed';
			case 'processing':
				return 'Processing...';
			case 'failed':
				return 'Failed';
			default:
				return 'Pending';
		}
	};

	return (
		<div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg border border-gray-700">
			<div className="flex items-center space-x-3">
				<div className="w-8 h-8 bg-orange-500/20 rounded flex items-center justify-center">
					<FileIcon className="w-4 h-4 text-orange-400" />
				</div>
				<div>
					<p className="font-medium text-white">{file.originalName}</p>
					<div className="flex items-center space-x-3 text-sm">
						<span className="text-gray-400">
							{(file.size / 1024).toFixed(1)} KB
						</span>
						<span className={getStatusColor(file.status)}>
							{getStatusText(file.status)}
						</span>
						{file.totalChunks && (
							<span className="text-gray-400">{file.totalChunks} chunks</span>
						)}
						{file.embeddingTokens && (
							<span className="text-blue-400">
								{file.embeddingTokens} tokens
							</span>
						)}
					</div>
				</div>
			</div>

			<div className="flex items-center space-x-2">
				{isProcessing && <LoadingSpinner className="w-4 h-4 text-orange-400" />}

				<button
					onClick={onDelete}
					className="text-gray-400 hover:text-red-400 transition-colors p-1">
					<XIcon className="w-4 h-4" />
				</button>
			</div>
		</div>
	);
};

// Queued File Item Component
const QueuedFileItem = ({ file, onRemove }) => {
	return (
		<div className="flex items-center justify-between p-4 bg-blue-900/20 rounded-lg border border-blue-700/50">
			<div className="flex items-center space-x-3">
				<div className="w-8 h-8 bg-blue-500/20 rounded flex items-center justify-center">
					<FileIcon className="w-4 h-4 text-blue-400" />
				</div>
				<div>
					<p className="font-medium text-white">{file.name}</p>
					<div className="flex items-center space-x-3 text-sm">
						<span className="text-gray-400">
							{(file.size / 1024).toFixed(1)} KB
						</span>
						<span className="text-blue-400">Queued for upload</span>
					</div>
				</div>
			</div>

			<button
				onClick={onRemove}
				className="text-gray-400 hover:text-red-400 transition-colors p-1">
				<XIcon className="w-4 h-4" />
			</button>
		</div>
	);
};

// Loading Skeleton Component
const BotDetailSkeleton = () => (
	<DashboardLayout>
		<div className="max-w-6xl mx-auto space-y-8">
			{/* Header Skeleton */}
			<div className="flex justify-between items-start">
				<div className="space-y-3">
					<div className="h-6 bg-gray-800 rounded w-32 animate-pulse"></div>
					<div className="h-8 bg-gray-800 rounded w-64 animate-pulse"></div>
					<div className="h-4 bg-gray-800 rounded w-96 animate-pulse"></div>
				</div>
				<div className="flex space-x-3">
					<div className="h-8 bg-gray-800 rounded w-16 animate-pulse"></div>
					<div className="h-10 bg-gray-800 rounded w-20 animate-pulse"></div>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
				{/* Main Content Skeleton */}
				<div className="lg:col-span-2 space-y-6">
					{/* Stats Skeleton */}
					<div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
						<div className="h-6 bg-gray-800 rounded w-24 mb-4 animate-pulse"></div>
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
							{[...Array(4)].map((_, i) => (
								<div key={i} className="text-center space-y-2">
									<div className="h-8 bg-gray-800 rounded w-12 mx-auto animate-pulse"></div>
									<div className="h-4 bg-gray-800 rounded w-16 mx-auto animate-pulse"></div>
								</div>
							))}
						</div>
					</div>

					{/* Files Skeleton */}
					<div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
						<div className="h-6 bg-gray-800 rounded w-32 mb-4 animate-pulse"></div>
						<div className="space-y-3">
							{[...Array(3)].map((_, i) => (
								<div
									key={i}
									className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
									<div className="flex items-center space-x-3">
										<div className="w-8 h-8 bg-gray-700 rounded animate-pulse"></div>
										<div className="space-y-2">
											<div className="h-4 bg-gray-700 rounded w-32 animate-pulse"></div>
											<div className="h-3 bg-gray-700 rounded w-24 animate-pulse"></div>
										</div>
									</div>
									<div className="h-5 bg-gray-700 rounded w-5 animate-pulse"></div>
								</div>
							))}
						</div>
					</div>
				</div>

				{/* Sidebar Skeleton */}
				<div className="space-y-6">
					{/* Quick Actions Skeleton */}
					<div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
						<div className="h-6 bg-gray-800 rounded w-28 mb-4 animate-pulse"></div>
						<div className="space-y-3">
							{[...Array(3)].map((_, i) => (
								<div
									key={i}
									className="h-12 bg-gray-800 rounded animate-pulse"></div>
							))}
						</div>
					</div>

					{/* Bot Info Skeleton */}
					<div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
						<div className="h-6 bg-gray-800 rounded w-32 mb-4 animate-pulse"></div>
						<div className="space-y-3">
							{[...Array(6)].map((_, i) => (
								<div key={i} className="flex justify-between">
									<div className="h-4 bg-gray-800 rounded w-20 animate-pulse"></div>
									<div className="h-4 bg-gray-800 rounded w-32 animate-pulse"></div>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	</DashboardLayout>
);

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

	const {
		bot,
		loading: botLoading,
		error: botError,
		updating,
		updateBot,
		toggleStatus,
		deleteBot,
	} = useBot(botId);

	const {
		files,
		loading: filesLoading,
		error: filesError,
		processingFiles,
		deleteFile,
		refetch: refetchFiles,
	} = useBotFiles(botId);

	const [isEditing, setIsEditing] = useState(false);
	const [editForm, setEditForm] = useState({
		name: '',
		description: '',
	});
	const [notification, setNotification] = useState(null);
	const [queuedFiles, setQueuedFiles] = useState([]);
	const [uploading, setUploading] = useState(false);

	// Update form when bot data loads
	useEffect(() => {
		if (bot) {
			setEditForm({
				name: bot.name || '',
				description: bot.description || '',
			});
		}
	}, [bot]);

	// Show notification
	const showNotification = (message, type = 'success') => {
		setNotification({ message, type });
		setTimeout(() => setNotification(null), 5000);
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

	const handleFilesUploaded = async (uploadedFiles) => {
		// Add files to queue instead of uploading immediately
		setQueuedFiles((prev) => [...prev, ...uploadedFiles]);
		showNotification(`${uploadedFiles.length} file(s) added to queue`);
	};

	const handleStartUpload = async () => {
		if (queuedFiles.length === 0) return;

		setUploading(true);

		try {
			// Extract the actual File objects from the queued file objects
			const actualFiles = queuedFiles.map((fileObj) => fileObj.file);

			// Validate all files before uploading
			const invalidFiles = actualFiles.filter(
				(file) => !file || !file.name || !file.size
			);
			if (invalidFiles.length > 0) {
				showNotification(
					`Invalid files detected: ${invalidFiles.length} files are missing required properties`,
					'error'
				);
				console.error('Invalid files:', invalidFiles);
				return;
			}

			console.log(
				`Starting upload of ${actualFiles.length} files to bot ${botId}`
			);

			// Use the well-tested fileAPI.uploadMultiple function
			const result = await fileAPI.uploadMultiple(
				actualFiles,
				botId,
				{
					generateEmbeddings: true,
					maxChunkSize: 700,
					overlap: 100,
				},
				(progress) => {
					// Optional: Handle progress updates
					console.log(
						`Upload progress: ${progress.fileName} - ${progress.status}`
					);
				}
			);

			// Show results
			if (result.success) {
				showNotification(
					`Successfully uploaded ${result.uploadedCount} file(s). ` +
						`${
							result.totalTokensUsed
						} tokens used ($${result.totalEstimatedCost.toFixed(6)})`
				);
			} else {
				showNotification(
					`Uploaded ${result.uploadedCount}/${queuedFiles.length} files. ` +
						`${result.errorCount} failed. ${result.totalTokensUsed} tokens used.`,
					result.errorCount > 0 ? 'error' : 'success'
				);
			}

			// Show individual file results
			result.results.forEach((fileResult) => {
				if (!fileResult.success) {
					showNotification(
						`Failed to upload ${fileResult.file}: ${fileResult.error}`,
						'error'
					);
				}
			});
		} catch (error) {
			showNotification(`Upload failed: ${error.message}`, 'error');
		} finally {
			// Clear queue and refresh files
			setQueuedFiles([]);
			setUploading(false);
			refetchFiles();
		}
	};

	const handleRemoveFromQueue = (fileToRemove) => {
		setQueuedFiles((prev) => prev.filter((file) => file !== fileToRemove));
		showNotification(`${fileToRemove.name} removed from queue`);
	};

	const handleClearQueue = () => {
		if (queuedFiles.length === 0) return;
		setQueuedFiles([]);
		showNotification('Queue cleared');
	};

	const handleDeleteFile = async (fileId, fileName) => {
		if (!confirm(`Are you sure you want to delete ${fileName}?`)) {
			return;
		}

		const result = await deleteFile(fileId);
		if (result.success) {
			showNotification(`${fileName} deleted successfully`);
		} else {
			showNotification(result.error || `Failed to delete ${fileName}`, 'error');
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
									className="text-2xl font-bold text-white bg-transparent border-b-2 border-orange-500 focus:outline-none max-w-md"
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
							}`}
						>
							Overview & Files
						</button>
						<button
							onClick={() => setActiveTab('api-config')}
							className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
								activeTab === 'api-config'
									? 'border-orange-500 text-orange-400'
									: 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-700'
							}`}
						>
							API Configuration
						</button>
						<button
							onClick={() => setActiveTab('chat')}
							className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
								activeTab === 'chat'
									? 'border-orange-500 text-orange-400'
									: 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-700'
							}`}
						>
							Test Chat
						</button>
					</nav>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
					{/* Main Content */}
					{activeTab === 'overview' && (
						<div className="lg:col-span-7 space-y-6">
							{/* Stats */}
							<div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
								<h2 className="text-lg font-medium text-white mb-4">Overview</h2>
								<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
									<div className="text-center">
										<p className="text-2xl font-bold text-white">
											{bot.totalMessages || 0}
										</p>
										<p className="text-sm text-gray-200">Messages</p>
									</div>
									<div className="text-center">
										<p className="text-2xl font-bold text-white">
											{files.length}
										</p>
										<p className="text-sm text-gray-200">Files</p>
									</div>
									<div className="text-center">
										<p className="text-2xl font-bold text-orange-400">
											{bot.totalEmbeddings || 0}
										</p>
										<p className="text-sm text-gray-200">Embeddings</p>
									</div>
									<div className="text-center">
										<p className="text-2xl font-bold text-blue-400">
											{Math.floor((bot.totalTokens || 0) / 1000)}K
										</p>
										<p className="text-sm text-gray-200">Tokens</p>
									</div>
								</div>
							</div>

							{/* Files Management */}
							<div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
								<div className="flex items-center justify-between mb-4">
									<h2 className="text-lg font-medium text-white">
										Content Files
									</h2>
									{filesLoading && (
										<div className="flex items-center space-x-2 text-gray-400">
											<LoadingSpinner className="w-4 h-4" />
											<span className="text-sm">Loading files...</span>
										</div>
									)}
								</div>

								{filesError && (
									<div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-4">
										<p className="text-red-100 text-sm">{filesError}</p>
									</div>
								)}

								{/* Upload Queue */}
								{queuedFiles.length > 0 && (
									<div className="mb-6">
										<div className="flex items-center justify-between mb-3">
											<h3 className="text-sm font-medium text-blue-300">
												Upload Queue ({queuedFiles.length} files)
											</h3>
											<div className="flex space-x-2">
												<button
													onClick={handleStartUpload}
													disabled={uploading}
													className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
													{uploading ? (
														<>
															<LoadingSpinner className="w-3 h-3 mr-1 inline-block" />
															Uploading...
														</>
													) : (
														'Start Upload'
													)}
												</button>
												<button
													onClick={handleClearQueue}
													disabled={uploading}
													className="px-3 py-1 border border-gray-600 text-gray-300 hover:bg-gray-700 text-sm rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
													Clear Queue
												</button>
											</div>
										</div>
										<div className="space-y-2">
											{queuedFiles.map((file, index) => (
												<QueuedFileItem
													key={`queued-${index}`}
													file={file}
													onRemove={() => handleRemoveFromQueue(file)}
												/>
											))}
										</div>
									</div>
								)}

								{/* Current Files */}
								<div className="space-y-3 mb-6">
									{files.map((file) => (
										<FileItem
											key={file.id}
											file={file}
											isProcessing={processingFiles.has(file.id)}
											onDelete={() =>
												handleDeleteFile(file.id, file.originalName)
											}
										/>
									))}

									{files.length === 0 && !filesLoading && (
										<div className="text-center py-8">
											<FileIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
											<p className="text-gray-400">No files uploaded yet</p>
											<p className="text-gray-500 text-sm">
												Upload some files to get started
											</p>
										</div>
									)}
								</div>

								{/* Upload New Files */}
								<div>
									<h3 className="text-sm font-medium text-gray-300 mb-3">
										Add More Files
									</h3>
									<FileUpload
										onFilesUploaded={handleFilesUploaded}
										maxFiles={5}
										disabled={uploading}
										className="border-gray-700 bg-gray-800"
									/>
									{queuedFiles.length === 0 && (
										<p className="text-sm text-gray-500 mt-2">
											Files will be added to upload queue. Click "Start Upload" to
											process them.
										</p>
									)}
								</div>
							</div>

							{/* Bot Information */}
							<div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
								<h3 className="text-lg font-medium text-white mb-4">
									Bot Information
								</h3>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
									<div>
										<span className="text-gray-400">Created:</span>
										<span className="ml-2 text-gray-200">
											{new Date(bot.createdAt).toLocaleDateString()}
										</span>
									</div>
									<div>
										<span className="text-gray-400">Last Updated:</span>
										<span className="ml-2 text-gray-200">
											{new Date(bot.updatedAt).toLocaleDateString()}
										</span>
									</div>
									<div className="md:col-span-2">
										<span className="text-gray-400">Bot ID:</span>
										<span className="ml-2 font-mono text-gray-200 text-xs break-all">
											{bot.id}
										</span>
									</div>
									<div className="md:col-span-2">
										<span className="text-gray-400">Bot Key:</span>
										<span className="ml-2 font-mono text-gray-200 text-xs break-all">
											{bot.botKey}
										</span>
									</div>
									<div>
										<span className="text-gray-400">Theme Color:</span>
										<div className="flex items-center space-x-2 mt-1">
											<div
												className="w-4 h-4 rounded border border-gray-600"
												style={{
													backgroundColor:
														bot.customization?.bubbleColor || '#f97316',
												}}
											/>
											<span className="font-mono text-gray-200 text-xs">
												{bot.customization?.bubbleColor || '#f97316'}
											</span>
										</div>
									</div>
									<div>
										<span className="text-gray-400">Position:</span>
										<span className="ml-2 text-gray-200 capitalize">
											{(bot.customization?.position || 'bottom-right').replace(
												'-',
												' '
											)}
										</span>
									</div>
									<div className="md:col-span-2">
										<span className="text-gray-400">Vector Storage:</span>
										<span
											className={`ml-2 text-xs px-2 py-1 rounded ${
												bot.vectorStorage?.enabled
													? 'bg-green-900 text-green-200'
													: 'bg-gray-800 text-gray-400'
											}`}>
											{bot.vectorStorage?.enabled ? 'Enabled' : 'Disabled'}
										</span>
									</div>
								</div>
							</div>

							{/* Quick Actions */}
							<div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
								<h3 className="text-lg font-medium text-white mb-4">
									Quick Actions
								</h3>
								<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
									<Link
										href={`/dashboard/bots/${bot.id}/embed`}
										className="block w-full bg-orange-100 hover:bg-orange-200 text-orange-700 py-3 px-4 rounded-lg text-center font-medium transition-colors">
										Get Embed Code
									</Link>
									<button
										onClick={handleToggleStatus}
										disabled={updating}
										className={`w-full py-3 px-4 rounded-lg text-center font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
											bot.status === 'active'
												? 'bg-red-100 hover:bg-red-200 text-red-700'
												: 'bg-green-100 hover:bg-green-200 text-green-700'
										}`}>
										{updating
											? 'Updating...'
											: bot.status === 'active'
											? 'Disable Bot'
											: 'Enable Bot'}
									</button>
									<button className="w-full bg-gray-800 hover:bg-gray-700 text-gray-200 py-3 px-4 rounded-lg text-center font-medium transition-colors">
										Download Chat History
									</button>
									<button
										onClick={handleDeleteBot}
										disabled={updating}
										className="w-full bg-red-900 hover:bg-red-800 text-red-100 py-3 px-4 rounded-lg text-center font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
										{updating ? 'Deleting...' : 'Delete Bot'}
									</button>
								</div>
							</div>
						</div>
					)}

					{/* API Configuration Tab */}
					{activeTab === 'api-config' && (
						<div className="lg:col-span-7 space-y-6">
							<div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
								<APIKeyManager botId={bot.id} />
							</div>
						</div>
					)}

					{/* Chat Interface - Show on all tabs but take full width on chat tab */}
					{activeTab === 'chat' ? (
						<div className="lg:col-span-12">
							<div className="bg-gray-900 rounded-lg border border-gray-800 h-[800px] flex flex-col">
								<ChatInterface botId={bot.id} botName={bot.name} />
							</div>
						</div>
					) : (
						<div className="lg:col-span-5">
							<div className="bg-gray-900 rounded-lg border border-gray-800 h-[800px] flex flex-col">
								<ChatInterface botId={bot.id} botName={bot.name} />
							</div>
						</div>
					)}
				</div>
			</div>
		</DashboardLayout>
	);
}
