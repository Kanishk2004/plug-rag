import APIKeyManager from '@/components/APIKeyManager';
import { CheckIcon } from '@/components/ui/icons';

/**
 * API Configuration Tab Component - Manage API keys for the bot
 * @param {Object} props
 * @param {string} props.botId - Bot ID
 * @param {Object} props.apiKeyStatus - API key status object
 * @param {Function} props.onApiKeyUpdate - Callback when API key is updated
 * @param {Function} props.onNavigateToOverview - Callback to switch to overview tab
 */
export default function APIConfigTab({
	botId,
	apiKeyStatus,
	onApiKeyUpdate,
	onNavigateToOverview,
}) {
	return (
		<div className="lg:col-span-12 space-y-6">
			<div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
				<div className="mb-4">
					<h2 className="text-lg font-medium text-white mb-2">
						API Configuration
					</h2>
					<p className="text-sm text-gray-400">
						Configure your custom OpenAI API key to enable file uploads and
						ensure optimal performance.
					</p>
				</div>
				<APIKeyManager botId={botId} onKeyUpdate={onApiKeyUpdate} />
			</div>

			{/* Return to Files Helper */}
			{apiKeyStatus.hasCustomKey && apiKeyStatus.keyStatus === 'valid' && (
				<div className="bg-green-900/20 border border-green-700/30 rounded-lg p-6">
					<div className="flex items-center justify-between">
						<div className="flex items-center space-x-3">
							<div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
								<CheckIcon className="w-4 h-4 text-green-400" />
							</div>
							<div>
								<h3 className="text-green-300 font-medium">
									API Key Successfully Configured!
								</h3>
								<p className="text-green-200/80 text-sm mt-1">
									You can now upload files and process content for your bot.
								</p>
							</div>
						</div>
						<button
							onClick={onNavigateToOverview}
							className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">
							Upload Files →
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
