import {
	FileIcon,
	XIcon,
	LoadingSpinner,
	CheckIcon,
} from '@/components/ui/icons';

const QueuedFileItem = ({ file, onRemove, disabled }) => {
	const getStatusDisplay = () => {
		switch (file.uploadStatus) {
			case 'queued':
				return {
					bgColor: 'bg-blue-900/20',
					borderColor: 'border-blue-700/50',
					iconBg: 'bg-blue-500/20',
					iconColor: 'text-blue-400',
					textColor: 'text-blue-400',
					progressBar: 'bg-blue-500',
					text: 'Queued for upload',
					showProgress: false,
				};
			case 'initializing':
				return {
					bgColor: 'bg-orange-900/20',
					borderColor: 'border-orange-700/50',
					iconBg: 'bg-orange-500/20',
					iconColor: 'text-orange-400',
					textColor: 'text-orange-400',
					progressBar: 'bg-orange-500',
					text: 'Initializing...',
					showProgress: false,
					showSpinner: true,
				};
			case 'uploading':
				return {
					bgColor: 'bg-orange-900/20',
					borderColor: 'border-orange-700/50',
					iconBg: 'bg-orange-500/20',
					iconColor: 'text-orange-400',
					textColor: 'text-orange-400',
					progressBar: 'bg-orange-500',
					text: `Uploading to S3... ${file.progress || 0}%`,
					showProgress: true,
					showSpinner: true,
				};
			case 'completing':
				return {
					bgColor: 'bg-orange-900/20',
					borderColor: 'border-orange-700/50',
					iconBg: 'bg-orange-500/20',
					iconColor: 'text-orange-400',
					textColor: 'text-orange-400',
					progressBar: 'bg-orange-500',
					text: 'Finalizing upload...',
					showProgress: true,
					showSpinner: true,
				};
			case 'completed':
				return {
					bgColor: 'bg-green-900/20',
					borderColor: 'border-green-700/50',
					iconBg: 'bg-green-500/20',
					iconColor: 'text-green-400',
					textColor: 'text-green-400',
					progressBar: 'bg-green-500',
					text: 'Upload completed ✓',
					showProgress: true,
					showCheck: true,
				};
			case 'failed':
				return {
					bgColor: 'bg-red-900/20',
					borderColor: 'border-red-700/50',
					iconBg: 'bg-red-500/20',
					iconColor: 'text-red-400',
					textColor: 'text-red-400',
					progressBar: 'bg-red-500',
					text: file.error || 'Upload failed',
					showProgress: false,
				};
			default:
				return {
					bgColor: 'bg-gray-900/20',
					borderColor: 'border-gray-700/50',
					iconBg: 'bg-gray-500/20',
					iconColor: 'text-gray-400',
					textColor: 'text-gray-400',
					progressBar: 'bg-gray-500',
					text: 'Unknown status',
					showProgress: false,
				};
		}
	};

	const status = getStatusDisplay();
	const canRemove =
		!disabled &&
		(file.uploadStatus === 'queued' || file.uploadStatus === 'failed');

	return (
		<div
			className={`flex flex-col p-4 rounded-lg border ${status.bgColor} ${status.borderColor}`}>
			<div className="flex items-center justify-between">
				<div className="flex items-center space-x-3 flex-1">
					<div
						className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${status.iconBg}`}>
						{status.showSpinner ? (
							<LoadingSpinner className={`w-4 h-4 ${status.iconColor}`} />
						) : status.showCheck ? (
							<CheckIcon className={`w-4 h-4 ${status.iconColor}`} />
						) : (
							<FileIcon className={`w-4 h-4 ${status.iconColor}`} />
						)}
					</div>
					<div className="flex-1 min-w-0">
						<p className="font-medium text-white truncate">{file.name}</p>
						<div className="flex items-center space-x-3 text-sm">
							<span className="text-gray-400">
								{(file.size / 1024).toFixed(1)} KB
							</span>
							<span className={status.textColor}>{status.text}</span>
						</div>
					</div>
				</div>

				{canRemove && (
					<button
						onClick={onRemove}
						className="text-gray-400 hover:text-red-400 transition-colors p-1 flex-shrink-0 ml-2"
						title="Remove from queue">
						<XIcon className="w-4 h-4" />
					</button>
				)}
			</div>

			{/* Progress Bar */}
			{status.showProgress && (
				<div className="mt-3">
					<div className="w-full bg-gray-700 rounded-full h-1.5">
						<div
							className={`${status.progressBar} h-1.5 rounded-full transition-all duration-300`}
							style={{ width: `${file.progress || 0}%` }}
						/>
					</div>
				</div>
			)}
		</div>
	);
};

export default QueuedFileItem;
