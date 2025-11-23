import Image from 'next/image';

const StatCard = ({
	title,
	value,
	change,
	changeType,
	icon: Icon,
	iconSrc,
}) => {
	const changeColors = {
		positive: 'text-green-400',
		negative: 'text-red-400',
		neutral: 'text-gray-200',
	};

	return (
		<div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
			<div className="flex items-center">
				<div className="flex-1">
					<p className="text-sm font-medium text-gray-200">{title}</p>
					<p className="text-2xl font-bold text-white">{value}</p>
					<p className={`text-sm ${changeColors[changeType]}`}>{change}</p>
				</div>
				<div className="ml-4">
					<div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center border border-orange-500/30">
						{iconSrc ? (
							<Image
								src={iconSrc}
								alt={`${title} icon`}
								width={24}
								height={24}
								className="brightness-0 invert opacity-90"
							/>
						) : (
							<Icon className="w-6 h-6 text-orange-400" />
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default StatCard;
