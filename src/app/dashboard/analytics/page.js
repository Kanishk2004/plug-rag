'use client';
import DashboardLayout from '@/components/layout/DashboardLayout';

export default function Analytics() {
	return (
		<DashboardLayout>
			<div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
				<div className="max-w-2xl mx-auto text-center space-y-6 px-4">
					{/* Icon */}
					<div className="flex justify-center">
						<div className="w-24 h-24 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center shadow-lg">
							<AnalyticsIcon className="w-12 h-12 text-white" />
						</div>
					</div>

					{/* Title */}
					<h1 className="text-4xl font-bold text-white">Analytics Dashboard</h1>

					{/* Subtitle */}
					<p className="text-xl text-gray-300">Coming Soon</p>

					{/* Description */}
					<div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
						<p className="text-gray-200">
							We're working hard to build comprehensive analytics for your
							chatbots.
						</p>
						<p className="text-gray-300 text-sm">
							Soon you'll be able to track:
						</p>
						<ul className="text-left text-gray-300 text-sm space-y-2 max-w-md mx-auto">
							<li className="flex items-start space-x-3">
								<CheckIcon className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
								<span>Real-time conversation metrics</span>
							</li>
							<li className="flex items-start space-x-3">
								<CheckIcon className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
								<span>User engagement analytics</span>
							</li>
							<li className="flex items-start space-x-3">
								<CheckIcon className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
								<span>Response accuracy insights</span>
							</li>
							<li className="flex items-start space-x-3">
								<CheckIcon className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
								<span>Usage trends and patterns</span>
							</li>
							<li className="flex items-start space-x-3">
								<CheckIcon className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
								<span>Export and reporting capabilities</span>
							</li>
						</ul>
					</div>

					{/* Status Badge */}
					<div className="inline-flex items-center space-x-2 bg-orange-900/20 border border-orange-800 rounded-full px-4 py-2">
						<div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
						<span className="text-orange-200 text-sm font-medium">
							Under Development
						</span>
					</div>
				</div>
			</div>
		</DashboardLayout>
	);
}

// Icons
const AnalyticsIcon = ({ className }) => (
	<svg
		className={className}
		fill="none"
		viewBox="0 0 24 24"
		strokeWidth={1.5}
		stroke="currentColor">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
		/>
	</svg>
);

const CheckIcon = ({ className }) => (
	<svg
		className={className}
		fill="none"
		viewBox="0 0 24 24"
		strokeWidth={1.5}
		stroke="currentColor">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="m4.5 12.75 6 6 9-13.5"
		/>
	</svg>
);
