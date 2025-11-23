const BotCardSkeleton = () => (
	<div className="bg-gray-900 rounded-lg border border-gray-800 p-6 animate-pulse">
		<div className="flex justify-between items-start mb-4">
			<div className="flex-1">
				<div className="h-5 bg-gray-700 rounded w-3/4 mb-2"></div>
				<div className="h-4 bg-gray-700 rounded w-full"></div>
			</div>
			<div className="ml-4">
				<div className="h-6 w-16 bg-gray-700 rounded-full"></div>
			</div>
		</div>
		<div className="grid grid-cols-2 gap-4 mb-4">
			<div className="text-center">
				<div className="h-8 bg-gray-700 rounded w-12 mx-auto mb-1"></div>
				<div className="h-3 bg-gray-700 rounded w-16 mx-auto"></div>
			</div>
			<div className="text-center">
				<div className="h-8 bg-gray-700 rounded w-8 mx-auto mb-1"></div>
				<div className="h-3 bg-gray-700 rounded w-12 mx-auto"></div>
			</div>
		</div>
		<div className="grid grid-cols-2 gap-4 mb-4">
			<div className="text-center">
				<div className="h-6 bg-gray-700 rounded w-10 mx-auto mb-1"></div>
				<div className="h-3 bg-gray-700 rounded w-16 mx-auto"></div>
			</div>
			<div className="text-center">
				<div className="h-6 bg-gray-700 rounded w-12 mx-auto mb-1"></div>
				<div className="h-3 bg-gray-700 rounded w-14 mx-auto"></div>
			</div>
		</div>
		<div className="mb-6">
			<div className="h-3 bg-gray-700 rounded w-32 mb-1"></div>
			<div className="h-3 bg-gray-700 rounded w-24"></div>
		</div>
		<div className="flex space-x-2">
			<div className="flex-1 h-8 bg-gray-700 rounded"></div>
			<div className="flex-1 h-8 bg-gray-700 rounded"></div>
			<div className="w-16 h-8 bg-gray-700 rounded"></div>
		</div>
	</div>
);

export default BotCardSkeleton;
