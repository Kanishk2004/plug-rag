import { useState } from 'react';
import Link from 'next/link';
import FileUpload from '@/components/FileUpload';
import {
	LoadingSpinner,
	SettingsIcon,
	CheckIcon,
	WarningIcon,
} from '@/components/ui/icons';
import { useBotFiles } from '@/hooks/useBotFiles';
import { fileAPI } from '@/lib/clientAPI';
import FileItem from '@/components/files/FileItem';
import QueuedFileItem from '@/components/files/QueuedFileItem';

/**
 * Overview Tab Component - Bot overview, files, and actions
 * @param {Object} props
 * @param {Object} props.bot - Bot data
 * @param {Object} props.apiKeyStatus - API key status object
 * @param {Function} props.showNotification - Notification callback
 * @param {Function} props.onBotUpdate - Callback to trigger bot refetch
 * @param {Function} props.onToggleStatus - Callback to toggle bot status
 * @param {Function} props.onDeleteBot - Callback to delete bot
 * @param {Function} props.onNavigateToApiConfig - Callback to switch to API config tab
 */
export default function OverviewTab({
	bot,
	apiKeyStatus,
	showNotification,
	onBotUpdate,
	onToggleStatus,
	onDeleteBot,
	onNavigateToApiConfig,
}) {
	const {
		files,
		loading: filesLoading,
		error: filesError,
		processingFiles,
		deleteFile,
		refetch: refetchFiles,
	} = useBotFiles(bot.id);

	const [queuedFiles, setQueuedFiles] = useState([]);
	const [uploading, setUploading] = useState(false);
	const [showDeletedFiles, setShowDeletedFiles] = useState(false);

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
				`Starting upload of ${actualFiles.length} files to bot ${bot.id}`
			);

			// Use the well-tested fileAPI.uploadMultiple function
			const result = await fileAPI.uploadMultiple(
				actualFiles,
				bot.id,
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

		try {
			const response = await fetch(`/api/files/${fileId}`, {
				method: 'DELETE',
			});

			const data = await response.json();

			if (response.ok && data.success) {
				// Check for warnings
				if (data.data?.warnings && data.data.warnings.length > 0) {
					showNotification(
						`${fileName} deleted (${data.data.warnings.join(', ')})`,
						'warning'
					);
				} else {
					showNotification(`${fileName} deleted successfully`);
				}

				// Refresh file list
				await refetchFiles();
			} else {
				showNotification(data.error || `Failed to delete ${fileName}`, 'error');
			}
		} catch (error) {
			showNotification(
				`Failed to delete ${fileName}: ${error.message}`,
				'error'
			);
		}
	};

	return (
		<div className="lg:col-span-12 space-y-6">
			{/* Stats */}
			<div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-lg font-medium text-white">Overview</h2>
				</div>
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
					<div className="text-center">
						<div className="flex items-center justify-center space-x-1 mb-1">
							<p className="text-2xl font-bold text-orange-400">
								{bot.analytics?.totalEmbeddings || bot.totalEmbeddings || 0}
							</p>
						</div>
						<p className="text-xs text-gray-300">Embeddings</p>
					</div>
					<div className="text-center">
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
				</div>
			</div>

			{/* Files Management */}
			<div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-lg font-medium text-white">Content Files</h2>
					<div className="flex items-center space-x-3">
						{filesLoading && (
							<div className="flex items-center space-x-2 text-gray-400">
								<LoadingSpinner className="w-4 h-4" />
								<span className="text-sm">Loading files...</span>
							</div>
						)}
						<button
							onClick={() => setShowDeletedFiles(!showDeletedFiles)}
							className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
								showDeletedFiles
									? 'bg-gray-700 text-gray-200 border border-gray-600'
									: 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700 hover:text-gray-300'
							}`}>
							{showDeletedFiles ? 'Hide' : 'Show'} Deleted (
							{
								files.filter(
									(f) =>
										f.status === 'deleted' || f.embeddingStatus === 'deleted'
								).length
							}
							)
						</button>
					</div>
				</div>

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
					{files
						.filter((file) => {
							// Filter out deleted files unless showDeletedFiles is true
							const isDeleted =
								file.status === 'deleted' ||
								file.embeddingStatus === 'deleted';
							return showDeletedFiles || !isDeleted;
						})
						.map((file) => {
							const isDeleted =
								file.status === 'deleted' ||
								file.embeddingStatus === 'deleted';
							return (
								<div key={file.id} className={isDeleted ? 'opacity-50' : ''}>
									<FileItem
										file={file}
										isProcessing={processingFiles.has(file.id)}
										onDelete={() => handleDeleteFile(file.id, file.filename)}
									/>
								</div>
							);
						})}

					{files.filter((f) => {
						const isDeleted =
							f.status === 'deleted' || f.embeddingStatus === 'deleted';
						return showDeletedFiles || !isDeleted;
					}).length === 0 &&
						!filesLoading && (
							<div>
								<p className="text-gray-400">No files uploaded yet</p>
								<p className="text-gray-500 text-sm">
									Upload some files to get started
								</p>
							</div>
						)}
				</div>

				{/* Upload New Files or API Key Setup Guidance */}
				<div>
					<h3 className="text-sm font-medium text-gray-300 mb-3">
						Add More Files
					</h3>

					{/* Show API Key Setup Guidance */}
					{(!apiKeyStatus.hasCustomKey ||
						!['valid'].includes(apiKeyStatus.keyStatus)) &&
						!apiKeyStatus.loading && (
							<div className="bg-gradient-to-r from-orange-900/20 to-blue-900/20 border-l-4 border-orange-500 rounded-lg p-6">
								<div className="flex items-start space-x-3">
									<div className="flex-shrink-0">
										<div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center">
											<WarningIcon className="w-4 h-4 text-orange-400" />
										</div>
									</div>
									<div className="flex-1">
										<h4 className="text-orange-300 font-medium text-sm mb-2">
											Setup Required: Configure API Key First
										</h4>
										<p className="text-gray-300 text-sm mb-4 leading-relaxed">
											To ensure optimal performance and cost control, please
											configure your custom OpenAI API key before uploading
											files. This prevents usage of global API limits and gives
											you full control over your bot's processing.
										</p>

										<div className="space-y-3">
											<div className="flex items-center space-x-2 text-sm">
												<span className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-medium">
													1
												</span>
												<span className="text-gray-200">
													Switch to the{' '}
													<span className="text-orange-300 font-medium">
														"API Configuration"
													</span>{' '}
													tab above
												</span>
											</div>
											<div className="flex items-center space-x-2 text-sm">
												<span className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-medium">
													2
												</span>
												<span className="text-gray-200">
													Enter your OpenAI API key and save
												</span>
											</div>
											<div className="flex items-center space-x-2 text-sm">
												<span className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-medium">
													3
												</span>
												<span className="text-gray-200">
													Return here to upload and process your files
												</span>
											</div>
										</div>

										<div className="mt-4 pt-4 border-t border-gray-700">
											<button
												onClick={onNavigateToApiConfig}
												className="inline-flex items-center px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors">
												<SettingsIcon className="w-4 h-4 mr-2" />
												Configure API Key
											</button>

											<p className="text-xs text-gray-400 mt-2">
												Need help getting an API key?
												<a
													href="https://platform.openai.com/api-keys"
													target="_blank"
													rel="noopener noreferrer"
													className="text-orange-400 hover:text-orange-300 ml-1">
													Get your OpenAI API key here →
												</a>
											</p>
										</div>
									</div>
								</div>
							</div>
						)}

					{/* Show loading state */}
					{apiKeyStatus.loading && (
						<div className="bg-gray-800 rounded-lg p-6 text-center">
							<LoadingSpinner className="w-6 h-6 text-orange-400 mx-auto mb-2" />
							<p className="text-gray-400 text-sm">
								Checking API key configuration...
							</p>
						</div>
					)}

					{/* Show FileUpload when API key is configured */}
					{apiKeyStatus.hasCustomKey &&
						apiKeyStatus.keyStatus === 'valid' &&
						!apiKeyStatus.loading && (
							<>
								<div className="bg-green-900/20 border border-green-700/30 rounded-lg p-4 mb-4">
									<div className="flex items-center space-x-2">
										<div className="w-5 h-5 bg-green-500/20 rounded-full flex items-center justify-center">
											<CheckIcon className="w-3 h-3 text-green-400" />
										</div>
										<p className="text-green-300 text-sm font-medium">
											✓ API Key Configured - Ready for file uploads
										</p>
									</div>
								</div>

								<FileUpload
									onFilesUploaded={handleFilesUploaded}
									maxFiles={5}
									disabled={uploading}
									className="border-gray-700 bg-gray-800"
								/>
								{queuedFiles.length === 0 && (
									<p className="text-sm text-gray-500 mt-2">
										Files will be added to upload queue. Click "Start Upload"
										to process them.
									</p>
								)}
							</>
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
				<h3 className="text-lg font-medium text-white mb-4">Quick Actions</h3>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
					<Link
						href={`/dashboard/bots/${bot.id}/embed`}
						className="block w-full bg-orange-100 hover:bg-orange-200 text-orange-700 py-3 px-4 rounded-lg text-center font-medium transition-colors">
						Get Embed Code
					</Link>
					<button
						onClick={onToggleStatus}
						className={`w-full py-3 px-4 rounded-lg text-center font-medium transition-colors ${
							bot.status === 'active'
								? 'bg-red-100 hover:bg-red-200 text-red-700'
								: 'bg-green-100 hover:bg-green-200 text-green-700'
						}`}>
						{bot.status === 'active' ? 'Disable Bot' : 'Enable Bot'}
					</button>
					<button className="w-full bg-gray-800 hover:bg-gray-700 text-gray-200 py-3 px-4 rounded-lg text-center font-medium transition-colors">
						Download Chat History
					</button>
					<button
						onClick={onDeleteBot}
						className="w-full bg-red-900 hover:bg-red-800 text-red-100 py-3 px-4 rounded-lg text-center font-medium transition-colors">
						Delete Bot
					</button>
				</div>
			</div>
		</div>
	);
}
