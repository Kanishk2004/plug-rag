import { useState, useEffect } from 'react';
import Link from 'next/link';
import FileUpload from '@/components/FileUpload';
import {
	LoadingSpinner,
	SettingsIcon,
	CheckIcon,
	WarningIcon,
	RefreshIcon,
} from '@/components/ui/icons';
import { useBotFiles } from '@/hooks/useBotFiles';
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
 * @param {Function} props.onNavigateToEmbed - Callback to switch to Embed tab
 */
export default function OverviewTab({
	bot,
	apiKeyStatus,
	showNotification,
	onBotUpdate,
	onToggleStatus,
	onDeleteBot,
	onNavigateToApiConfig,
	onNavigateToEmbed,
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
	const [uploadProgress, setUploadProgress] = useState({});

	const handleFilesUploaded = async (uploadedFiles) => {
		// Add files to queue with metadata
		const filesWithMetadata = uploadedFiles.map((fileObj) => ({
			...fileObj,
			uploadStatus: 'queued', // queued, initializing, uploading, completing, completed, failed
			progress: 0,
			error: null,
			fileId: null,
			uploadUrl: null,
		}));
		setQueuedFiles((prev) => [...prev, ...filesWithMetadata]);
		showNotification(`${uploadedFiles.length} file(s) added to queue`);
	};

	/**
	 * Step 1: Initialize file upload and get presigned URL
	 */
	const initializeFileUpload = async (file) => {
		console.log('[INIT-UPLOAD] Initializing upload:', {
			fileName: file.name,
			fileSize: file.size,
			mimeType: file.type,
			botId: bot.id,
		});

		const formData = new FormData();
		formData.append('botId', bot.id);
		formData.append('filename', file.file.name);
		formData.append('fileSize', file.file.size);
		formData.append('mimeType', file.file.type);

		const response = await fetch('/api/files/upload/init', {
			method: 'POST',
			body: formData,
		});

		const data = await response.json();

		if (!response.ok || !data.success) {
			console.error('[INIT-UPLOAD] Failed:', data);
			throw new Error(data.error || 'Failed to initialize upload');
		}

		console.log('[INIT-UPLOAD] Success:', {
			fileId: data.data.fileId,
			hasUploadUrl: !!data.data.uploadUrl,
		});

		return data.data; // { uploadUrl, fileId, s3Key, expiresIn }
	};

	/**
	 * Step 2: Upload file to S3 using presigned URL
	 * Matches Postman's binary upload with Content-Type header
	 */
	const uploadFileToS3 = async (
		actualFile,
		uploadUrl,
		mimeType,
		onProgress
	) => {
		console.log('[S3-UPLOAD] Starting upload:', {
			fileName: actualFile.name,
			fileSize: actualFile.size,
			mimeType: mimeType,
			uploadUrlPrefix: uploadUrl.substring(0, 100) + '...',
		});

		// Read file as ArrayBuffer (raw binary data, like Postman)
		const fileBuffer = await actualFile.arrayBuffer();
		console.log(
			'[S3-UPLOAD] File read as ArrayBuffer, size:',
			fileBuffer.byteLength
		);

		return new Promise((resolve, reject) => {
			const xhr = new XMLHttpRequest();

			// Track upload progress
			xhr.upload.addEventListener('progress', (e) => {
				if (e.lengthComputable) {
					const percentComplete = Math.round((e.loaded / e.total) * 100);
					onProgress(percentComplete);
				}
			});

			xhr.addEventListener('load', () => {
				console.log('[S3-UPLOAD] Response received:', {
					status: xhr.status,
					statusText: xhr.statusText,
					responseHeaders: xhr.getAllResponseHeaders(),
				});

				if (xhr.status === 200) {
					console.log('[S3-UPLOAD] Upload successful');
					resolve();
				} else {
					console.error('[S3-UPLOAD] Upload failed:', {
						status: xhr.status,
						statusText: xhr.statusText,
						response: xhr.responseText,
					});
					reject(
						new Error(
							`S3 upload failed with status ${xhr.status}: ${xhr.statusText}`
						)
					);
				}
			});

			xhr.addEventListener('error', (e) => {
				console.error('[S3-UPLOAD] Network error:', e);
				reject(
					new Error('Network error during S3 upload. Possible CORS issue.')
				);
			});

			xhr.addEventListener('abort', () => {
				console.warn('[S3-UPLOAD] Upload aborted');
				reject(new Error('Upload aborted'));
			});

			xhr.open('PUT', uploadUrl);

			// Set Content-Type header (matching Postman)
			xhr.setRequestHeader('Content-Type', mimeType);

			console.log('[S3-UPLOAD] Headers set:', { 'Content-Type': mimeType });
			console.log('[S3-UPLOAD] Sending ArrayBuffer...');

			// Send raw binary data
			xhr.send(fileBuffer);
		});
	};

	/**
	 * Step 3: Complete upload and queue for processing
	 */
	const completeFileUpload = async (fileId) => {
		const response = await fetch('/api/files/upload/complete', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ fileId }),
		});

		const data = await response.json();

		if (!response.ok || !data.success) {
			throw new Error(data.error || 'Failed to complete upload');
		}

		return data.data;
	};

	/**
	 * Upload a single file through the 3-step process
	 */
	const uploadSingleFile = async (queuedFile, index) => {
		console.log('[UPLOAD-FILE] Starting upload process:', queuedFile.name);

		try {
			// Update status: Initializing
			setQueuedFiles((prev) =>
				prev.map((f, i) =>
					i === index ? { ...f, uploadStatus: 'initializing', progress: 0 } : f
				)
			);

			// Step 1: Initialize and get presigned URL
			const initData = await initializeFileUpload(queuedFile);

			setQueuedFiles((prev) =>
				prev.map((f, i) =>
					i === index
						? {
								...f,
								fileId: initData.fileId,
								uploadUrl: initData.uploadUrl,
								uploadStatus: 'uploading',
						  }
						: f
				)
			);

			// Step 2: Upload to S3 with progress tracking
			await uploadFileToS3(
				queuedFile.file,
				initData.uploadUrl,
				queuedFile.type || queuedFile.file.type,
				(progress) => {
					setQueuedFiles((prev) =>
						prev.map((f, i) => (i === index ? { ...f, progress } : f))
					);
				}
			);

			// Update status: Completing
			setQueuedFiles((prev) =>
				prev.map((f, i) =>
					i === index ? { ...f, uploadStatus: 'completing', progress: 100 } : f
				)
			);

			// Step 3: Complete upload and queue for processing
			await completeFileUpload(initData.fileId);

			console.log(
				'[UPLOAD-FILE] Upload completed successfully:',
				queuedFile.name
			);

			// Mark as completed
			setQueuedFiles((prev) =>
				prev.map((f, i) =>
					i === index ? { ...f, uploadStatus: 'completed', progress: 100 } : f
				)
			);

			return { success: true, fileId: initData.fileId };
		} catch (error) {
			console.error(`[UPLOAD-FILE] Error uploading ${queuedFile.name}:`, error);

			// Mark as failed
			setQueuedFiles((prev) =>
				prev.map((f, i) =>
					i === index
						? {
								...f,
								uploadStatus: 'failed',
								error: error.message,
						  }
						: f
				)
			);

			return { success: false, error: error.message, file: queuedFile.name };
		}
	};

	const handleStartUpload = async () => {
		if (queuedFiles.length === 0) return;

		setUploading(true);

		const results = {
			total: queuedFiles.length,
			successful: 0,
			failed: 0,
			errors: [],
		};

		try {
			// Upload files sequentially to avoid overwhelming the server
			for (let i = 0; i < queuedFiles.length; i++) {
				const file = queuedFiles[i];

				// Skip already completed or failed files
				if (file.uploadStatus === 'completed') {
					results.successful++;
					continue;
				}

				const result = await uploadSingleFile(file, i);

				if (result.success) {
					results.successful++;
				} else {
					results.failed++;
					results.errors.push(result.error);
				}
			}

			// Show summary notification
			if (results.failed === 0) {
				showNotification(
					`Successfully uploaded and queued ${results.successful} file(s) for processing`
				);
			} else {
				showNotification(
					`Upload completed: ${results.successful} successful, ${results.failed} failed`,
					'warning'
				);
			}

			// Show individual error messages
			results.errors.forEach((error) => {
				showNotification(error, 'error');
			});
		} catch (error) {
			showNotification(`Upload process failed: ${error.message}`, 'error');
		} finally {
			setUploading(false);
			// Refresh files list to show newly uploaded files
			refetchFiles();

			// Clear completed files from queue after a delay
			setTimeout(() => {
				setQueuedFiles((prev) =>
					prev.filter((f) => f.uploadStatus !== 'completed')
				);
			}, 2000);
		}
	};

	const handleRemoveFromQueue = (fileToRemove) => {
		setQueuedFiles((prev) => prev.filter((file) => file !== fileToRemove));
		showNotification(`${fileToRemove.name} removed from queue`);
	};

	const handleClearQueue = () => {
		if (queuedFiles.length === 0) return;

		// Only clear files that haven't started uploading
		const canClear = queuedFiles.filter(
			(f) => f.uploadStatus === 'queued' || f.uploadStatus === 'failed'
		);

		if (canClear.length === 0) {
			showNotification('No files to clear (uploads in progress)', 'warning');
			return;
		}

		setQueuedFiles((prev) =>
			prev.filter(
				(f) => f.uploadStatus !== 'queued' && f.uploadStatus !== 'failed'
			)
		);
		showNotification(`Cleared ${canClear.length} file(s) from queue`);
	};

	const handleRetryFile = async (fileId, fileName) => {
		try {
			const response = await fetch('/api/files/upload/retry', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ fileId }),
			});

			const data = await response.json();

			if (response.ok && data.success) {
				showNotification(`${fileName} queued for retry`);
				await refetchFiles();
			} else {
				showNotification(data.error || `Failed to retry ${fileName}`, 'error');
			}
		} catch (error) {
			showNotification(
				`Failed to retry ${fileName}: ${error.message}`,
				'error'
			);
		}
	};

	const handleCancelFile = async (fileId, fileName) => {
		if (
			!confirm(`Are you sure you want to cancel processing for ${fileName}?`)
		) {
			return;
		}

		try {
			const response = await fetch('/api/files/upload/cancel', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ fileId }),
			});

			const data = await response.json();

			if (response.ok && data.success) {
				showNotification(`${fileName} processing cancelled`);
				await refetchFiles();
			} else {
				showNotification(data.error || `Failed to cancel ${fileName}`, 'error');
			}
		} catch (error) {
			showNotification(
				`Failed to cancel ${fileName}: ${error.message}`,
				'error'
			);
		}
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
									disabled={uploading}
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
								file.status === 'deleted' || file.embeddingStatus === 'deleted';
							return showDeletedFiles || !isDeleted;
						})
						.map((file) => {
							const isDeleted =
								file.status === 'deleted' || file.embeddingStatus === 'deleted';
							return (
								<div key={file.id} className={isDeleted ? 'opacity-50' : ''}>
									<FileItem
										file={file}
										isProcessing={processingFiles.has(file.id)}
										onDelete={() => handleDeleteFile(file.id, file.filename)}
										onRetry={handleRetryFile}
										onCancel={handleCancelFile}
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
										Files will be added to upload queue. Click "Start Upload" to
										process them.
									</p>
								)}
							</>
						)}
				</div>
			</div>

			{/* Bot Information */}
			<div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
				<h3 className="text-lg font-medium text-white mb-4">Bot Information</h3>
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
					<div>
						<span className="text-gray-400">Title (assistant name):</span>
						<span className="ml-2 text-gray-200">
							{bot.customization?.title || 'My Chat Bot'}
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
									backgroundColor: bot.customization?.bubbleColor || '#f97316',
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
					<button
						onClick={onNavigateToEmbed}
						className="w-full bg-orange-100 hover:bg-orange-200 text-orange-700 py-3 px-4 rounded-lg text-center font-medium transition-colors">
						Get Embed Code
					</button>
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
