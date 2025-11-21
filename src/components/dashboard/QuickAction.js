import Link from 'next/link';
import Image from 'next/image';

const QuickAction = ({ title, description, href, icon: Icon, iconSrc }) => {
	return (
		<Link
			href={href}
			className="flex items-center p-3 rounded-lg border border-gray-700 hover:bg-orange-500/10 hover:border-orange-500/50 transition-colors">
			<div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center mr-3 border border-orange-500/30">
				{iconSrc ? (
					<Image
						src={iconSrc}
						alt={`${title} icon`}
						width={20}
						height={20}
						className="brightness-0 invert opacity-90"
					/>
				) : (
					<Icon className="w-5 h-5 text-orange-400" />
				)}
			</div>
			<div className="flex-1">
				<h4 className="font-medium text-white">{title}</h4>
				<p className="text-sm text-gray-200">{description}</p>
			</div>
		</Link>
	);
};

export default QuickAction;