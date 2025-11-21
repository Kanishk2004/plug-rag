import DashboardLayout from '@/components/layout/DashboardLayout';

const BotDetailSkeleton = () => (
	<DashboardLayout>
		<div className="max-w-6xl mx-auto space-y-8">
			{/* Header Skeleton */}
			<div className="flex justify-between items-start">
				<div className="space-y-3">
					<div className="h-6 bg-gray-800 rounded w-32 animate-pulse"></div>
					<div className="h-8 bg-gray-800 rounded w-64 animate-pulse"></div>
					<div className="h-4 bg-gray-800 rounded w-96 animate-pulse"></div>
				</div>
				<div className="flex space-x-3">
					<div className="h-8 bg-gray-800 rounded w-16 animate-pulse"></div>
					<div className="h-10 bg-gray-800 rounded w-20 animate-pulse"></div>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
				{/* Main Content Skeleton */}
				<div className="lg:col-span-2 space-y-6">
					{/* Stats Skeleton */}
					<div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
						<div className="h-6 bg-gray-800 rounded w-24 mb-4 animate-pulse"></div>
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
							{[...Array(4)].map((_, i) => (
								<div key={i} className="text-center space-y-2">
									<div className="h-8 bg-gray-800 rounded w-12 mx-auto animate-pulse"></div>
									<div className="h-4 bg-gray-800 rounded w-16 mx-auto animate-pulse"></div>
								</div>
							))}
						</div>
					</div>

					{/* Files Skeleton */}
					<div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
						<div className="h-6 bg-gray-800 rounded w-32 mb-4 animate-pulse"></div>
						<div className="space-y-3">
							{[...Array(3)].map((_, i) => (
								<div
									key={i}
									className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
									<div className="flex items-center space-x-3">
										<div className="w-8 h-8 bg-gray-700 rounded animate-pulse"></div>
										<div className="space-y-2">
											<div className="h-4 bg-gray-700 rounded w-32 animate-pulse"></div>
											<div className="h-3 bg-gray-700 rounded w-24 animate-pulse"></div>
										</div>
									</div>
									<div className="h-5 bg-gray-700 rounded w-5 animate-pulse"></div>
								</div>
							))}
						</div>
					</div>
				</div>

				{/* Sidebar Skeleton */}
				<div className="space-y-6">
					{/* Quick Actions Skeleton */}
					<div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
						<div className="h-6 bg-gray-800 rounded w-28 mb-4 animate-pulse"></div>
						<div className="space-y-3">
							{[...Array(3)].map((_, i) => (
								<div
									key={i}
									className="h-12 bg-gray-800 rounded animate-pulse"></div>
							))}
						</div>
					</div>

					{/* Bot Info Skeleton */}
					<div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
						<div className="h-6 bg-gray-800 rounded w-32 mb-4 animate-pulse"></div>
						<div className="space-y-3">
							{[...Array(6)].map((_, i) => (
								<div key={i} className="flex justify-between">
									<div className="h-4 bg-gray-800 rounded w-20 animate-pulse"></div>
									<div className="h-4 bg-gray-800 rounded w-32 animate-pulse"></div>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	</DashboardLayout>
);

export default BotDetailSkeleton;