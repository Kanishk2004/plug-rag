import ChatInterface from '@/components/ChatInterface';
import { WarningIcon } from '@/components/ui/icons';

/**
 * Chat Tab Component - Test chat interface for the bot
 * @param {Object} props
 * @param {Object} props.bot - Bot data
 * @param {Object} props.apiKeyStatus - API key status object
 * @param {Function} props.onNavigateToApiConfig - Callback to switch to API config tab
 */
export default function ChatTab({ bot, apiKeyStatus, onNavigateToApiConfig }) {
	return (
		<div className="lg:col-span-12">
			<div className="bg-gray-900 rounded-lg border border-gray-800 h-[800px] flex flex-col">
				<div className="p-4 border-b border-gray-800">
					<h2 className="text-lg font-medium text-white">Test Chat</h2>
					<p className="text-sm text-gray-400 mt-1">
						Test your bot's responses and functionality
					</p>

					{/* API Key Warning */}
					{(!apiKeyStatus.hasCustomKey ||
						apiKeyStatus.keyStatus !== 'valid') &&
						!apiKeyStatus.loading && (
							<div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-3 mt-3">
								<div className="flex items-center space-x-2">
									<WarningIcon className="w-4 h-4 text-yellow-400 flex-shrink-0" />
									<div className="flex-1">
										<p className="text-yellow-300 text-sm font-medium">
											Limited functionality without API key
										</p>
										<p className="text-yellow-200/80 text-xs mt-1">
											Chat will use global API limits. Configure your API key
											for full functionality.
										</p>
									</div>
									<button
										onClick={onNavigateToApiConfig}
										className="text-yellow-300 hover:text-yellow-200 text-xs font-medium">
										Configure →
									</button>
								</div>
							</div>
						)}
				</div>
				<div className="flex-1">
					<ChatInterface botId={bot.id} botName={bot.name} />
				</div>
			</div>
		</div>
	);
}
