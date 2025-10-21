'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import Image from 'next/image';

const DashboardLayout = ({ children }) => {
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const pathname = usePathname();

	const navigation = [
		{ name: 'Dashboard', href: '/dashboard', iconSrc: '/icons/dashboard.png' },
		{ name: 'My Bots', href: '/dashboard/bots', iconSrc: '/icons/bot.png' },
		{ name: 'Create Bot', href: '/dashboard/create-bot', iconSrc: '/icons/plus.png' },
		{ name: 'Analytics', href: '/dashboard/analytics', iconSrc: '/icons/analytics.png' },
		{ name: 'Settings', href: '/dashboard/settings', iconSrc: '/icons/settings.png' },
	];

	const isCurrentPath = (href) => {
		if (href === '/dashboard') {
			return pathname === '/dashboard';
		}
		return pathname?.startsWith(href);
	};

	return (
		<div className="min-h-screen bg-black">
			{/* Mobile menu overlay */}
			{sidebarOpen && (
				<div className="fixed inset-0 z-50 lg:hidden">
					<div
						className="fixed inset-0 bg-black/80"
						onClick={() => setSidebarOpen(false)}
					/>
					<div className="fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 shadow-xl">
						<SidebarContent
							navigation={navigation}
							isCurrentPath={isCurrentPath}
						/>
					</div>
				</div>
			)}

			{/* Desktop sidebar */}
			<div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
				<div className="flex grow flex-col overflow-y-auto bg-gray-900 border-r border-gray-800">
					<SidebarContent
						navigation={navigation}
						isCurrentPath={isCurrentPath}
					/>
				</div>
			</div>

			{/* Main content */}
			<div className="lg:pl-64">
				{/* Top bar */}
				<div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-800 bg-gray-900 px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
					<button
						type="button"
						className="-m-2.5 p-2.5 text-gray-200 hover:text-white lg:hidden"
						onClick={() => setSidebarOpen(true)}>
						<span className="sr-only">Open sidebar</span>
						<MenuIcon className="h-6 w-6" />
					</button>

					<div className="h-6 w-px bg-gray-700 lg:hidden" />

					<div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
						<div className="flex flex-1" />
						<div className="flex items-center gap-x-4 lg:gap-x-6">
							<UserButton />
						</div>
					</div>
				</div>

				{/* Page content */}
				<main className="py-10">
					<div className="px-4 sm:px-6 lg:px-8">{children}</div>
				</main>
			</div>
		</div>
	);
};

const SidebarContent = ({ navigation, isCurrentPath }) => {
	return (
		<div className="flex flex-col h-full">
			{/* Logo */}
			<div className="flex h-16 shrink-0 items-center px-6 border-b border-gray-800">
				<div className="flex items-center space-x-2">
					<div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
						<span className="text-white font-bold text-sm">P</span>
					</div>
					<h1 className="text-xl font-bold text-white">PlugRAG</h1>
				</div>
			</div>

			{/* Navigation */}
			<nav className="flex flex-1 flex-col px-6 py-6">
				<ul role="list" className="flex flex-1 flex-col gap-y-2">
					{navigation.map((item) => (
						<li key={item.name}>
							<Link
								href={item.href}
								className={`group flex gap-x-3 rounded-md p-3 text-sm font-medium transition-colors ${
									isCurrentPath(item.href)
										? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
										: 'text-gray-200 hover:text-orange-400 hover:bg-orange-500/10'
								}`}>
								<div className="h-5 w-5 shrink-0 flex items-center justify-center">
									<Image
										src={item.iconSrc}
										alt={`${item.name} icon`}
										width={20}
										height={20}
										className={`${
											isCurrentPath(item.href)
												? 'opacity-100 brightness-0 invert'
												: 'opacity-75 brightness-0 invert group-hover:opacity-100'
										}`}
									/>
								</div>
								{item.name}
							</Link>
						</li>
					))}
				</ul>
			</nav>
		</div>
	);
};

// Icons

const MenuIcon = ({ className }) => (
	<svg
		className={className}
		fill="none"
		viewBox="0 0 24 24"
		strokeWidth={1.5}
		stroke="currentColor">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
		/>
	</svg>
);

export default DashboardLayout;
