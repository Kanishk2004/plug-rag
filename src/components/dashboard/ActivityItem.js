import { PlusIcon, UploadIcon, XIcon, CodeIcon, ChatIcon, ActivityIcon } from '@/components/ui/icons';

const ActivityItem = ({ action, target, time, type }) => {
	const getIcon = () => {
		switch (type) {
			case 'create':
				return PlusIcon;
			case 'upload':
				return UploadIcon;
			case 'disable':
				return XIcon;
			case 'embed':
				return CodeIcon;
			case 'chat':
				return ChatIcon;
			default:
				return ActivityIcon;
		}
	};

	const Icon = getIcon();

	return (
		<div className="flex items-center py-3 border-b border-gray-800 last:border-0">
			<div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center mr-3">
				<Icon className="w-4 h-4 text-gray-300" />
			</div>
			<div className="flex-1">
				<p className="text-sm text-gray-200">
					<span className="font-medium text-white">{action}</span> {target}
				</p>
				<p className="text-xs text-gray-300">{time}</p>
			</div>
		</div>
	);
};

export default ActivityItem;