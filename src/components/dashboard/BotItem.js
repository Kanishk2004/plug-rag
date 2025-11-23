import Link from 'next/link';

const BotItem = ({ id, name, status, conversations, lastActive }) => {
	return (
		<Link href={`/dashboard/bots/${id}`} className="block">
			<div className="flex items-center justify-between py-3 border-b border-gray-800 last:border-0 hover:bg-gray-800/50 transition-colors rounded px-2">
				<div className="flex-1">
					<h3 className="font-medium text-white">{name}</h3>
					<p className="text-sm text-gray-200">
						{conversations} conversation{conversations !== 1 ? 's' : ''} •{' '}
						{lastActive}
					</p>
				</div>
				<div className="ml-4">
					<span
						className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
							status === 'active'
								? 'bg-green-400/20 text-green-400 border border-green-400/30'
								: 'bg-gray-700 text-gray-200'
						}`}>
						{status}
					</span>
				</div>
			</div>
		</Link>
	);
};

export default BotItem;
