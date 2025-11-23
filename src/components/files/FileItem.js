import { FileIcon, XIcon, LoadingSpinner } from '@/components/ui/icons';

const FileItem = ({ file, isProcessing, onDelete }) => {
	const getStatusColor = (status) => {
		switch (status) {
			case 'processed':
				return 'text-green-400';
			case 'processing':
				return 'text-yellow-400';
			case 'failed':
				return 'text-red-400';
			default:
				return 'text-gray-400';
		}
	};

	const getStatusText = (status) => {
		switch (status) {
			case 'processed':
				return 'Processed';
			case 'processing':
				return 'Processing...';
			case 'failed':
				return 'Failed';
			default:
				return 'Unknown';
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

export default FileItem;
