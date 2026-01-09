import { useRef } from 'react';
import ChatInterface from '@/components/ChatInterface';
import { WarningIcon } from '@/components/ui/icons';

const ClearIcon = ({ className }) => (
	<svg
		className={className}
		fill="none"
		stroke="currentColor"
		viewBox="0 0 24 24">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={2}
			d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
		/>
	</svg>
);

/**
 * Chat Tab Component - Test chat interface for the bot
 * @param {Object} props
 * @param {Object} props.bot - Bot data
 * @param {Object} props.apiKeyStatus - API key status object
 * @param {Function} props.onNavigateToApiConfig - Callback to switch to API config tab
 */
export default function ChatTab({ bot, apiKeyStatus, onNavigateToApiConfig }) {
	const clearConversationRef = useRef(null);

	const handleClearConversation = async () => {
		if (!confirm('Are you sure you want to clear the conversation history?')) {
			return;
		}
		if (clearConversationRef.current) {
			await clearConversationRef.current();
		}
	};

	return (
		<div className="lg:col-span-12">
			<div className="bg-gray-900 rounded-lg border border-gray-800 h-[800px] flex flex-col">
				<div className="p-4 border-b border-gray-800">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-lg font-medium text-white">Test Chat</h2>
							<p className="text-sm text-gray-400 mt-1">
								Chat with {bot.name} - Test your bot's responses
							</p>
						</div>
						<button
							onClick={handleClearConversation}
							className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
							title="Clear conversation history">
							<ClearIcon className="w-5 h-5" />
						</button>
					</div>

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
					<ChatInterface 
						botId={bot.id} 
						botName={bot.name}
						onClearConversation={(fn) => { clearConversationRef.current = fn; }}
					/>
				</div>
			</div>
		</div>
	);
}
