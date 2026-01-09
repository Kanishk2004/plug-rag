import { FileIcon, XIcon, LoadingSpinner } from '@/components/ui/icons';

const FileItem = ({ file, isProcessing, onDelete }) => {
	const getFileStatus = () => {
		// Priority: Check file.status first for critical states
		if (file.status === 'deleted') {
			return { color: 'text-red-600', text: 'Deleted' };
		}
		if (file.status === 'failed') {
			return { color: 'text-red-400', text: 'Upload Failed' };
		}
		if (file.status === 'canceled') {
			return { color: 'text-gray-500', text: 'Canceled' };
		}

		// Check embeddingStatus for processing states
		switch (file.embeddingStatus) {
			case 'completed':
				return { color: 'text-green-400', text: 'Ready' };
			case 'processing':
				return { color: 'text-orange-400', text: 'Processing...' };
			case 'queued':
				return { color: 'text-blue-400', text: 'Queued' };
			case 'retrying':
				return { color: 'text-yellow-400', text: 'Retrying...' };
			case 'failed':
				return { color: 'text-red-400', text: 'Processing Failed' };
			case 'deleted':
				return { color: 'text-red-600', text: 'Deleted' };
			case 'canceled':
				return { color: 'text-gray-500', text: 'Canceled' };
			case 'pending':
				return { color: 'text-gray-400', text: 'Pending' };
			default:
				// Fallback to file.status
				if (file.status === 'uploaded') {
					return { color: 'text-blue-400', text: 'Uploaded' };
				}
				if (file.status === 'initialized') {
					return { color: 'text-gray-400', text: 'Initialized' };
				}
				return { color: 'text-gray-400', text: 'Unknown' };
		}
	};

	const { color: statusColor, text: statusText } = getFileStatus();

	return (
		<div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg border border-gray-700">
			<div className="flex items-center space-x-3">
				<div className="w-9 h-9 bg-orange-500/20 rounded flex items-center justify-center">
					<FileIcon className="w-6 h-6 text-orange-400" />
				</div>
				<div>
					<p className="font-medium text-white">{file.filename}</p>
					<div className="flex items-center space-x-3 text-sm">
						<span className="text-gray-400">
							{(file.size / 1024).toFixed(1)} KB
						</span>
						<span className={statusColor}>{statusText}</span>
						{file.totalChunks > 0 && (
							<span className="text-gray-400">{file.totalChunks} chunks</span>
						)}
						{file.embeddingTokens > 0 && (
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
					<XIcon className="w-6 h-6 bg-red-500 rounded text-white hover:bg-red-700" />
				</button>
			</div>
		</div>
	);
};

export default FileItem;
