import DashboardLayout from '@/components/layout/DashboardLayout';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/nextjs';
import { checkUserExists, syncUserWithDB } from '@/lib/integrations/clerk';
import { currentUser } from '@clerk/nextjs/server';
import Image from 'next/image';
import Link from 'next/link';
import connect from '@/lib/integrations/mongo';
import Bot from '@/models/Bot';
import Conversation from '@/models/Conversation';

// Component imports
import StatCard from '@/components/dashboard/StatCard';
import BotItem from '@/components/dashboard/BotItem';
import QuickAction from '@/components/dashboard/QuickAction';
import ActivityItem from '@/components/dashboard/ActivityItem';

// Icon imports
import { ChatIcon, ActiveIcon, BotsIcon, AnalyticsIcon } from '@/components/ui/icons';

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
