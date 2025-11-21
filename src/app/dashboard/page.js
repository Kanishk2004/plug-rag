import DashboardLayout from '@/components/layout/DashboardLayout';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/nextjs';
import { checkUserExists, syncUserWithDB } from '@/lib/user';
import { currentUser } from '@clerk/nextjs/server';
import Image from 'next/image';
import Link from 'next/link';
import connect from '@/lib/mongo';
import Bot from '@/models/Bot';
import Conversation from '@/models/Conversation';
import Message from '@/models/Message';

export default async function Dashboard() {
	// Performance optimized user sync
	const user = await currentUser();

	if (!user) {
		return <RedirectToSignIn />;
	}

	// Quick check if user exists (fast query)
	const userExists = await checkUserExists(user.id);

	if (!userExists) {
		// Create user synchronously to ensure it exists
		await syncUserWithDB(user.id);
	}

	// Fetch dashboard data
	let dashboardData = {
		totalBots: 0,
		activeBots: 0,
		totalConversations: 0,
		recentBots: [],
		recentActivity: [],
	};

	try {
		await connect();

		// Get user's bots (using ownerId instead of userId)
		const userBots = await Bot.find({ ownerId: user.id })
			.sort({ createdAt: -1 })
			.lean();

		dashboardData.totalBots = userBots.length;
		dashboardData.activeBots = userBots.filter(
			(bot) => bot.status === 'active'
		).length;

		// Get recent bots (last 3)
		dashboardData.recentBots = userBots.slice(0, 3);

		// Get conversation counts and update last active times
		// Use stored analytics for now due to model import issues
		for (const bot of dashboardData.recentBots) {
			// Use stored analytics data
			bot.conversationCount = bot.analytics?.totalSessions || 0;
			bot.totalMessages = bot.analytics?.totalMessages || 0;
			bot.lastActive = bot.analytics?.lastActiveAt || bot.updatedAt || bot.createdAt;
		}

		// Get total conversations across all bots using stored analytics
		if (userBots.length > 0) {
			// Calculate totals from stored analytics
			let totalConversations = 0;
			let activeBots = 0;
			const sevenDaysAgo = new Date();
			sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
			
			for (const bot of userBots) {
				totalConversations += bot.analytics?.totalSessions || 0;
				
				// Count as active if has activity in last 7 days
				const lastActive = bot.analytics?.lastActiveAt;
				if (lastActive && new Date(lastActive) >= sevenDaysAgo) {
					activeBots++;
				}
			}
			
			dashboardData.totalConversations = totalConversations;
			
			// Only override activeBots if we got some real data
			if (activeBots > 0 || totalConversations > 0) {
				dashboardData.activeBots = activeBots;
			}
			// Otherwise keep the status-based active count from before
		}

		// Generate recent activity from bots and conversations
		const recentActivity = [];

		// Add bot creation activities
		userBots.slice(0, 5).forEach((bot) => {
			recentActivity.push({
				action: 'New Bot created: ',
				target: bot.name,
				time: bot.createdAt,
				type: 'create',
			});
		});

		// Add recent conversation activities
		if (userBots.length > 0) {
			const botIds = userBots.map((bot) => bot._id);
			const recentConversations = await Conversation.find({
				botId: { $in: botIds },
			})
				.sort({ createdAt: -1 })
				.limit(3)
				.populate('botId', 'name')
				.lean();

			recentConversations.forEach((conversation) => {
				recentActivity.push({
					action: 'Conversation started',
					target: conversation.botId?.name || 'Unknown Bot',
					time: conversation.createdAt,
					type: 'chat',
				});
			});
		}

		// Sort by time and limit
		dashboardData.recentActivity = recentActivity
			.sort((a, b) => new Date(b.time) - new Date(a.time))
			.slice(0, 5);
	} catch (error) {
		console.error('Error fetching dashboard data:', error);
		// Set some fallback data to prevent page crash
		dashboardData = {
			totalBots: 0,
			activeBots: 0,
			totalConversations: 0,
			recentBots: [],
			recentActivity: [],
		};
	}

	return (
		<SignedIn>
			<DashboardLayout>
				<div className="space-y-8">
					{/* Header */}
					<div>
						<h1 className="text-2xl font-bold text-white">Dashboard</h1>
						<p className="mt-2 text-gray-200">
							Welcome back! Here&apos;s what&apos;s happening with your PlugRAG
							chatbots.
						</p>
					</div>

					{/* Stats Grid */}
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
						<StatCard
							title="Total Bots"
							value={dashboardData.totalBots.toString()}
							change={`${
								dashboardData.totalBots === 0
									? 'No bots created yet'
									: `${dashboardData.totalBots} bot${
											dashboardData.totalBots !== 1 ? 's' : ''
									  } total`
							}`}
							changeType="neutral"
							iconSrc="/icons/bot.png"
						/>
						<StatCard
							title="Total Conversations"
							value={dashboardData.totalConversations.toString()}
							change={`${
								dashboardData.totalConversations === 0
									? 'No conversations yet'
									: 'Across all bots'
							}`}
							changeType="neutral"
							icon={ChatIcon}
						/>
						<StatCard
							title="Active Bots"
							value={dashboardData.activeBots.toString()}
							change={`${Math.round(
								(dashboardData.activeBots /
									Math.max(dashboardData.totalBots, 1)) *
									100
							)}% active`}
							changeType={dashboardData.activeBots > 0 ? 'positive' : 'neutral'}
							icon={ActiveIcon}
						/>
					</div>

					{/* Recent Activity & Quick Actions */}
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
						{/* Recent Bots */}
						<div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
							<div className="flex items-center justify-between mb-4">
								<h2 className="text-lg font-medium text-white">Recent Bots</h2>
								<Link
									href="/dashboard/bots"
									className="text-sm text-orange-400 hover:text-orange-300 font-medium">
									View all
								</Link>
							</div>
							<div className="space-y-4">
								{dashboardData.recentBots.length > 0 ? (
									dashboardData.recentBots.map((bot) => (
										<BotItem
											key={bot._id}
											id={bot._id}
											name={bot.name}
											status={bot.status === 'active' ? 'active' : 'inactive'}
											conversations={bot.conversationCount || 0}
											lastActive={formatTimeAgo(bot.lastActive)}
										/>
									))
								) : (
									<div className="text-center py-8">
										<p className="text-gray-400">No bots created yet</p>
										<Link
											href="/dashboard/create-bot"
											className="text-orange-400 hover:text-orange-300 text-sm font-medium mt-2 inline-block">
											Create your first bot →
										</Link>
									</div>
								)}
							</div>
						</div>

						{/* Quick Actions */}
						<div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
							<h2 className="text-lg font-medium text-white mb-4">
								Quick Actions
							</h2>
							<div className="space-y-3">
								<QuickAction
									title="Create New Bot"
									description="Set up a new chatbot in minutes"
									href="/dashboard/create-bot"
									iconSrc="/icons/plus.png"
								/>
								<QuickAction
									title="Manage Bots"
									description="View and edit your existing bots"
									href="/dashboard/bots"
									icon={BotsIcon}
								/>
								<QuickAction
									title="View Analytics"
									description="Check your bot performance"
									href="/dashboard/analytics"
									iconSrc="/icons/analytics.png"
								/>
							</div>
						</div>
					</div>

					{/* Recent Activity Feed */}
					<div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
						<h2 className="text-lg font-medium text-white mb-4">
							Recent Activity
						</h2>
						<div className="space-y-4">
							{dashboardData.recentActivity.length > 0 ? (
								dashboardData.recentActivity.map((activity, index) => (
									<ActivityItem
										key={index}
										action={activity.action}
										target={activity.target}
										time={formatTimeAgo(activity.time)}
										type={activity.type}
									/>
								))
							) : (
								<div className="text-center py-8">
									<p className="text-gray-400">No recent activity</p>
									<p className="text-gray-500 text-sm mt-1">
										Activity will appear here as you use your bots
									</p>
								</div>
							)}
						</div>
					</div>
				</div>
			</DashboardLayout>
		</SignedIn>
	);
}

// Helper function to format time ago
function formatTimeAgo(date) {
	if (!date) return 'Unknown';

	const now = new Date();
	const time = new Date(date);
	const diffInSeconds = Math.floor((now - time) / 1000);

	if (diffInSeconds < 60) return 'Just now';
	if (diffInSeconds < 3600)
		return `${Math.floor(diffInSeconds / 60)} minutes ago`;
	if (diffInSeconds < 86400)
		return `${Math.floor(diffInSeconds / 3600)} hours ago`;
	if (diffInSeconds < 604800)
		return `${Math.floor(diffInSeconds / 86400)} days ago`;

	return time.toLocaleDateString();
}

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

// Icons
const BotsIcon = ({ className }) => (
	<svg
		className={className}
		fill="none"
		viewBox="0 0 24 24"
		strokeWidth={1.5}
		stroke="currentColor">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-10.5 3.75H7.5m9-6.75h.008v.008H16.5V7.5ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z"
		/>
	</svg>
);

const ChatIcon = ({ className }) => (
	<svg
		className={className}
		fill="none"
		viewBox="0 0 24 24"
		strokeWidth={1.5}
		stroke="currentColor">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.740.194V21l4.155-4.155"
		/>
	</svg>
);

const ActiveIcon = ({ className }) => (
	<svg
		className={className}
		fill="none"
		viewBox="0 0 24 24"
		strokeWidth={1.5}
		stroke="currentColor">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M9.348 14.652a3.75 3.75 0 0 1 0-5.304m5.304 0a3.75 3.75 0 0 1 0 5.304m-7.425 2.121a6.75 6.75 0 0 1 0-9.546m9.546 0a6.75 6.75 0 0 1 0 9.546M5.106 18.894c-3.808-3.807-3.808-9.98 0-13.788 3.807-3.808 9.98-3.808 13.788 0 3.808 3.807 3.808 9.98 0 13.788-3.807 3.808-9.98 3.808-13.788 0Z"
		/>
	</svg>
);

const PlusIcon = ({ className }) => (
	<svg
		className={className}
		fill="none"
		viewBox="0 0 24 24"
		strokeWidth={1.5}
		stroke="currentColor">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M12 4.5v15m7.5-7.5h-15"
		/>
	</svg>
);

const UploadIcon = ({ className }) => (
	<svg
		className={className}
		fill="none"
		viewBox="0 0 24 24"
		strokeWidth={1.5}
		stroke="currentColor">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
		/>
	</svg>
);

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

const CodeIcon = ({ className }) => (
	<svg
		className={className}
		fill="none"
		viewBox="0 0 24 24"
		strokeWidth={1.5}
		stroke="currentColor">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5"
		/>
	</svg>
);

const ActivityIcon = ({ className }) => (
	<svg
		className={className}
		fill="none"
		viewBox="0 0 24 24"
		strokeWidth={1.5}
		stroke="currentColor">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
		/>
	</svg>
);
