'use client';
import React, {
	useState,
	useCallback,
	useMemo,
	forwardRef,
	useImperativeHandle,
} from 'react';
import { apiUtils } from '@/lib/api';

const FileUpload = forwardRef(({ onFilesUploaded, maxFiles = 10 }, ref) => {
	const [files, setFiles] = useState([]);
	const [isDragging, setIsDragging] = useState(false);

	const acceptedTypes = useMemo(
		() => ({
			'application/pdf': '.pdf',
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
				'.docx',
			'text/plain': '.txt',
			'text/csv': '.csv',
			'text/html': '.html',
		}),
		[]
	);

	const maxFileSize = useMemo(() => 30 * 1024 * 1024, []); // 30MB

	const validateFile = useCallback(
		(file) => {
			const validation = apiUtils.validateFile(file, {
				maxSize: maxFileSize,
				allowedTypes: Object.keys(acceptedTypes),
			});
			return validation.isValid ? null : validation.error;
		},
		[acceptedTypes, maxFileSize]
	);

	const processFiles = useCallback(
		(fileList) => {
			const newFiles = Array.from(fileList).map((file) => {
				const error = validateFile(file);
				return {
					id: Math.random().toString(36).substr(2, 9),
					file,
					name: file.name,
					size: file.size,
					type: file.type,
					status: error ? 'error' : 'ready',
					error,
				};
			});

			setFiles((prev) => {
				const combined = [...prev, ...newFiles];
				if (combined.length > maxFiles) {
					return combined.slice(0, maxFiles);
				}
				return combined;
			});

			// Notify parent component with valid files
			const validFiles = newFiles.filter((f) => f.status !== 'error');
			if (validFiles.length > 0) {
				onFilesUploaded?.(validFiles);
			}
		},
		[maxFiles, onFilesUploaded, validateFile]
	);

	const removeFile = (fileId) => {
		setFiles((prev) => prev.filter((f) => f.id !== fileId));
	};

	const clearFiles = () => {
		setFiles([]);
	};

	// Expose clearFiles to parent component
	useImperativeHandle(ref, () => ({
		clearFiles,
	}));

	const handleDragEnter = (e) => {
		e.preventDefault();
		setIsDragging(true);
	};

	const handleDragLeave = (e) => {
		e.preventDefault();
		if (!e.currentTarget.contains(e.relatedTarget)) {
			setIsDragging(false);
		}
	};

	const handleDragOver = (e) => {
		e.preventDefault();
	};

	const handleDrop = (e) => {
		e.preventDefault();
		setIsDragging(false);
		const droppedFiles = e.dataTransfer.files;
		if (droppedFiles.length > 0) {
			processFiles(droppedFiles);
		}
	};

	const handleFileSelect = (e) => {
		const selectedFiles = e.target.files;
		if (selectedFiles.length > 0) {
			processFiles(selectedFiles);
		}
	};

	const formatFileSize = (bytes) => {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	};

	const getFileIcon = (type) => {
		if (type.includes('pdf')) return <PdfIcon />;
		if (type.includes('word')) return <DocIcon />;
		if (type.includes('text')) return <TxtIcon />;
		if (type.includes('csv')) return <CsvIcon />;
		if (type.includes('html')) return <HtmlIcon />;
		return <FileIcon />;
	};

	return (
		<div className="space-y-4">
			{/* Upload Area */}
			<div
				className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
					isDragging
						? 'border-orange-400 bg-orange-50'
						: 'border-gray-700 hover:border-gray-600'
				}`}
				onDragEnter={handleDragEnter}
				onDragLeave={handleDragLeave}
				onDragOver={handleDragOver}
				onDrop={handleDrop}>
				<div className="w-12 h-12 mx-auto mb-4 text-gray-300">
					<UploadIcon />
				</div>
				<div className="mb-2">
					<label htmlFor="file-upload" className="cursor-pointer">
						<span className="text-orange-600 hover:text-orange-700 font-medium">
							Click to upload
						</span>
						<span className="text-gray-200"> or drag and drop</span>
					</label>
					<input
						id="file-upload"
						type="file"
						multiple
						accept={Object.values(acceptedTypes).join(',')}
						onChange={handleFileSelect}
						className="hidden"
					/>
				</div>
				<p className="text-sm text-gray-200">
					PDF, DOCX, TXT, CSV, HTML up to 30MB each
				</p>
			</div>

			{/* File List */}
			{files.length > 0 && (
				<div className="space-y-2">
					<h3 className="text-sm font-medium text-gray-200">
						Selected Files ({files.length})
					</h3>
					<div className="space-y-2 max-h-64 overflow-y-auto">
						{files.map((fileObj) => (
							<FileItem
								key={fileObj.id}
								fileObj={fileObj}
								onRemove={() => removeFile(fileObj.id)}
								formatFileSize={formatFileSize}
								getFileIcon={getFileIcon}
							/>
						))}
					</div>
				</div>
			)}
		</div>
	);
});

const FileItem = ({ fileObj, onRemove, formatFileSize, getFileIcon }) => {
	const { name, size, status, error } = fileObj;

	return (
		<div className="flex items-center p-3 bg-gray-800 rounded-lg">
			<div className="flex-shrink-0 mr-3 text-gray-300">
				{getFileIcon(fileObj.type)}
			</div>

			<div className="flex-1 min-w-0">
				<div className="flex items-center justify-between mb-1">
					<p className="text-sm font-medium text-white truncate">{name}</p>
					<button
						onClick={onRemove}
						className="text-gray-300 hover:text-gray-400 flex-shrink-0 ml-2">
						<XIcon className="w-4 h-4" />
					</button>
				</div>

				<div className="flex items-center justify-between">
					<p className="text-xs text-gray-400">{formatFileSize(size)}</p>
					{status === 'error' && (
						<span className="text-xs text-red-600 font-medium">Error</span>
					)}
					{status === 'ready' && (
						<span className="text-xs text-green-600 font-medium">Ready</span>
					)}
				</div>

				{error && <p className="text-xs text-red-600 mt-1">{error}</p>}
			</div>
		</div>
	);
};

// Icons
const UploadIcon = () => (
	<svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
		/>
	</svg>
);

const XIcon = ({ className }) => (
	<svg
		className={className}
		fill="none"
		viewBox="0 0 24 24"
		strokeWidth={1.5}
		stroke="currentColor">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M6 18 18 6M6 6l12 12"
		/>
	</svg>
);

const PdfIcon = () => (
	<svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
		<path d="M8.267 14.68c-.184 0-.308.018-.372.036v1.178c.076.018.171.023.302.023.479 0 .774-.242.774-.651 0-.366-.254-.586-.704-.586zm3.487.012c-.2 0-.33.018-.407.036v2.61c.077.018.201.018.313.018.817.006 1.349-.444 1.349-1.396.006-.83-.479-1.268-1.255-1.268z" />
		<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM9.498 16.19c-.309.29-.765.42-1.296.42a2.23 2.23 0 0 1-.308-.018v1.426H7v-3.936A7.558 7.558 0 0 1 8.219 14c.557 0 .953.106 1.22.319.254.202.426.533.426.923-.001.392-.131.723-.367.948zm3.807 1.355c-.42.349-1.059.515-1.84.515-.468 0-.799-.03-1.024-.06v-3.917A7.947 7.947 0 0 1 11.66 14c.757 0 1.249.136 1.633.426.415.308.675.799.675 1.504 0 .763-.279 1.29-.663 1.615zM17 14.77h-1.532v.911H16.9v.734h-1.432v1.604h-.906V14.03H17v.74zM14 9h-1V4l5 5h-4z" />
	</svg>
);

const DocIcon = () => (
	<svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
		<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM16 18H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V4l5 5h-5z" />
	</svg>
);

const TxtIcon = () => (
	<svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
		<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM16 18H8v-2h8v2zm0-4H8v-2h8v2zm0-4H8V8h8v2zm-3-5V4l5 5h-5z" />
	</svg>
);

const CsvIcon = () => (
	<svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
		<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM10 17H8v-2h2v2zm0-4H8v-2h2v2zm4 4h-2v-2h2v2zm0-4h-2v-2h2v2zm2 4h-2v-2h2v2zm0-4h-2v-2h2v2zm-3-5V4l5 5h-5z" />
	</svg>
);

const HtmlIcon = () => (
	<svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
		<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM8.5 18l-1-4h1l.5 2.5L9.5 14h1l-1 4h-1zm2.5 0v-4h1v1.5h1V14h1v4h-1v-1.5h-1V18h-1zm4.5 0l-1-4h1l.5 2.5.5-2.5h1l-1 4h-1zM13 9V4l5 5h-5z" />
	</svg>
);

const FileIcon = () => (
	<svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
		<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM16 18H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V4l5 5h-5z" />
	</svg>
);

FileUpload.displayName = 'FileUpload';

export default FileUpload;
