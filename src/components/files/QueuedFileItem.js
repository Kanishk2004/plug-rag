import { FileIcon, XIcon } from '@/components/ui/icons';

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

export default QueuedFileItem;
