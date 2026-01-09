'use client';
import { useState, useEffect } from 'react';
import DomainWhitelist from '@/components/dashboard/DomainWhitelist';

export default function EmbedTab({ botId, bot, showNotification }) {
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [embedData, setEmbedData] = useState(null);
	const [copied, setCopied] = useState(false);

	const [customization, setCustomization] = useState({
		color: '#f97316',
		position: 'bottom-right',
		greeting: 'Hi! How can I help you today?',
		placeholder: 'Type your message...',
		title: 'Chat Assistant',
	});

	const [domains, setDomains] = useState([]);

	// Fetch embed code from API on mount
	useEffect(() => {
		if (!botId) return;

		const fetchEmbedCode = async () => {
			try {
				const response = await fetch(`/api/bots/${botId}/embed`);
				const data = await response.json();

				if (data.success) {
					setEmbedData(data.data);
					// Initialize customization from API response
					const botCustomization = data.data.botMetadata?.customization;
					if (botCustomization) {
						setCustomization({
							color: botCustomization.bubbleColor || '#f97316',
							position: botCustomization.position || 'bottom-right',
							greeting:
								botCustomization.greeting || 'Hi! How can I help you today?',
							placeholder:
								botCustomization.placeholder || 'Type your message...',
							title: botCustomization.title || 'Chat Assistant',
						});
					}
				} else {
					showNotification(
						data.message || 'Failed to load embed code',
						'error'
					);
				}
			} catch (err) {
				console.error('Error fetching embed code:', err);
				showNotification('Failed to load embed code', 'error');
			} finally {
				setLoading(false);
			}
		};

		fetchEmbedCode();
	}, [botId, showNotification]);

	// Initialize domains from bot data
	useEffect(() => {
		if (bot) {
			setDomains(bot.domainWhitelist || []);
		}
	}, [bot]);

	const handleCustomizationChange = (field, value) => {
		setCustomization((prev) => ({
			...prev,
			[field]: value,
		}));
	};

	const handleSaveCustomization = async () => {
		setSaving(true);
		try {
			const response = await fetch(`/api/bots/${botId}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					customization: {
						bubbleColor: customization.color,
						position: customization.position,
						greeting: customization.greeting,
						placeholder: customization.placeholder,
						title: customization.title,
					},
				}),
			});

			const data = await response.json();
			if (data.success) {
				showNotification('Customization saved successfully');
				// Refresh embed code
				const embedResponse = await fetch(`/api/bots/${botId}/embed`);
				const embedData = await embedResponse.json();
				if (embedData.success) {
					setEmbedData(embedData.data);
				}
			} else {
				showNotification(
					data.message || 'Failed to save customization',
					'error'
				);
			}
		} catch (err) {
			console.error('Error saving customization:', err);
			showNotification('Failed to save customization', 'error');
		} finally {
			setSaving(false);
		}
	};

	const generateEmbedCode = () => {
		const currentDomain =
			typeof window !== 'undefined'
				? window.location.origin
				: 'https://plugrag.com';

		return `<!-- PlugRAG Chatbot Widget -->
<script>
  window.PlugRAGConfig = {
    botId: "${botId}",
    color: "${customization.color}",
    position: "${customization.position}",
    greeting: "${customization.greeting}",
    placeholder: "${customization.placeholder}",
    title: "${customization.title}",
    apiBase: "${currentDomain}"
  };
</script>
<script src="${currentDomain}/embed.js" async></script>`;
	};

	const copyToClipboard = async () => {
		try {
			await navigator.clipboard.writeText(generateEmbedCode());
			setCopied(true);
			showNotification('Embed code copied to clipboard');
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error('Failed to copy: ', err);
			showNotification('Failed to copy to clipboard', 'error');
		}
	};

	if (loading) {
		return (
			<div className="lg:col-span-12">
				<div className="flex items-center justify-center py-12">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
				</div>
			</div>
		);
	}

	return (
		<div className="lg:col-span-12">
			<div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
				{/* Left Column - Customization & Domain Security */}
				<div className="xl:col-span-2 space-y-6">
					{/* Customization Panel */}
					<div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
						<h2 className="text-xl font-semibold text-white mb-2">
							🎨 Customization
						</h2>
						<p className="text-gray-400 mb-6">
							Customize the appearance and behavior of your chatbot widget
						</p>

						<div className="space-y-6">
							{/* Color Picker */}
							<div>
								<label className="block text-sm font-medium text-gray-300 mb-2">
									Theme Color
								</label>
								<div className="flex items-center space-x-3">
									<input
										type="color"
										value={customization.color}
										onChange={(e) =>
											handleCustomizationChange('color', e.target.value)
										}
										className="w-14 h-10 border border-gray-600 rounded-lg cursor-pointer bg-gray-700"
									/>
									<input
										type="text"
										value={customization.color}
										onChange={(e) =>
											handleCustomizationChange('color', e.target.value)
										}
										className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-white font-mono"
									/>
								</div>
							</div>

							{/* Position */}
							<div>
								<label className="block text-sm font-medium text-gray-300 mb-2">
									Position
								</label>
								<div className="grid grid-cols-2 gap-3">
									<button
										type="button"
										onClick={() =>
											handleCustomizationChange('position', 'bottom-left')
										}
										className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
											customization.position === 'bottom-left'
												? 'bg-orange-500 border-orange-500 text-white'
												: 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
										}`}>
										Bottom Left
									</button>
									<button
										type="button"
										onClick={() =>
											handleCustomizationChange('position', 'bottom-right')
										}
										className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
											customization.position === 'bottom-right'
												? 'bg-orange-500 border-orange-500 text-white'
												: 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
										}`}>
										Bottom Right
									</button>
									<button
										type="button"
										onClick={() =>
											handleCustomizationChange('position', 'top-left')
										}
										className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
											customization.position === 'top-left'
												? 'bg-orange-500 border-orange-500 text-white'
												: 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
										}`}>
										Top Left
									</button>
									<button
										type="button"
										onClick={() =>
											handleCustomizationChange('position', 'top-right')
										}
										className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
											customization.position === 'top-right'
												? 'bg-orange-500 border-orange-500 text-white'
												: 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
										}`}>
										Top Right
									</button>
								</div>
							</div>

							{/* Title */}
							<div>
								<label className="block text-sm font-medium text-gray-300 mb-2">
									Chat Title
								</label>
								<input
									type="text"
									value={customization.title}
									onChange={(e) =>
										handleCustomizationChange('title', e.target.value)
									}
									maxLength={50}
									className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-white"
									placeholder="Chat Assistant"
								/>
								<p className="mt-1 text-xs text-gray-400">
									{customization.title.length}/50 characters
								</p>
							</div>

							{/* Greeting Message */}
							<div>
								<label className="block text-sm font-medium text-gray-300 mb-2">
									Greeting Message
								</label>
								<textarea
									value={customization.greeting}
									onChange={(e) =>
										handleCustomizationChange('greeting', e.target.value)
									}
									maxLength={200}
									rows={2}
									className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-white resize-none"
									placeholder="Hi! How can I help you today?"
								/>
								<p className="mt-1 text-xs text-gray-400">
									{customization.greeting.length}/200 characters
								</p>
							</div>

							{/* Placeholder Text */}
							<div>
								<label className="block text-sm font-medium text-gray-300 mb-2">
									Input Placeholder
								</label>
								<input
									type="text"
									value={customization.placeholder}
									onChange={(e) =>
										handleCustomizationChange('placeholder', e.target.value)
									}
									maxLength={100}
									className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-white"
									placeholder="Type your message..."
								/>
								<p className="mt-1 text-xs text-gray-400">
									{customization.placeholder.length}/100 characters
								</p>
							</div>

							{/* Save Button */}
							<button
								onClick={handleSaveCustomization}
								disabled={saving}
								className="w-full px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
								{saving ? 'Saving Changes...' : 'Save Changes'}
							</button>
						</div>
					</div>

					{/* Domain Security */}
					<DomainWhitelist
						botId={botId}
						domains={domains}
						onDomainsChange={setDomains}
						showNotification={showNotification}
					/>

					{/* Embed Code */}
					<div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
						<div className="flex justify-between items-center mb-4">
							<h2 className="text-xl font-semibold text-white">
								📋 Embed Code
							</h2>
							<button
								onClick={copyToClipboard}
								className={`px-4 py-2 font-medium rounded-lg transition-all ${
									copied
										? 'bg-green-600 text-white border border-green-500'
										: 'bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600'
								}`}>
								{copied ? (
									<>
										<CheckIcon className="w-4 h-4 inline mr-2" />
										Copied!
									</>
								) : (
									<>
										<CopyIcon className="w-4 h-4 inline mr-2" />
										Copy Code
									</>
								)}
							</button>
						</div>

						<div className="bg-gray-900 rounded-lg p-4 overflow-x-auto border border-gray-700">
							<pre className="text-sm text-green-400 whitespace-pre-wrap font-mono">
								<code>{generateEmbedCode()}</code>
							</pre>
						</div>

						<div className="mt-4 p-4 bg-gray-700 rounded-lg border border-gray-600">
							<p className="font-medium mb-2 text-white text-sm">
								📖 Instructions:
							</p>
							<ol className="list-decimal list-inside space-y-1 text-gray-300 text-sm">
								<li>Copy the code above</li>
								<li>
									Paste it before the closing &lt;/body&gt; tag on your website
								</li>
								<li>The chatbot will appear automatically on your site</li>
							</ol>
						</div>
					</div>
				</div>

				{/* Right Column - Preview */}
				<div className="xl:col-span-1">
					<div className="sticky top-8">
						<div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
							<h2 className="text-xl font-semibold text-white mb-4">
								👁️ Live Preview
							</h2>

							{/* Mock Website */}
							<div
								className="relative bg-gray-100 rounded-xl overflow-hidden border-2 border-gray-600"
								style={{ height: '600px' }}>
								{/* Mock Header */}
								<div className="bg-white border-b border-gray-200 p-3">
									<div className="flex items-center space-x-3">
										<div className="w-6 h-6 bg-gray-300 rounded"></div>
										<div className="space-y-1">
											<div className="w-20 h-2 bg-gray-300 rounded"></div>
											<div className="w-14 h-1.5 bg-gray-200 rounded"></div>
										</div>
									</div>
								</div>

								{/* Mock Content */}
								<div className="p-4 space-y-3">
									<div className="w-3/4 h-3 bg-gray-300 rounded"></div>
									<div className="w-full h-3 bg-gray-200 rounded"></div>
									<div className="w-2/3 h-3 bg-gray-200 rounded"></div>
									<div className="w-1/2 h-20 bg-gray-300 rounded mt-4"></div>
								</div>

								{/* Chat Widget */}
								<div
									className={`absolute ${
										customization.position.includes('bottom')
											? 'bottom-3'
											: 'top-16'
									} ${
										customization.position.includes('right')
											? 'right-3'
											: 'left-3'
									} transition-all duration-300`}>
									<div className="relative">
										{/* Chat Button */}
										<button
											className="w-10 h-10 rounded-full shadow-lg flex items-center justify-center text-white transition-transform hover:scale-105"
											style={{ backgroundColor: customization.color }}>
											<ChatIcon className="w-5 h-5" />
										</button>

										{/* Chat Preview (always show for demo) */}
										<div
											className={`absolute ${
												customization.position.includes('bottom')
													? 'bottom-12'
													: 'top-12'
											} ${
												customization.position.includes('right')
													? 'right-0'
													: 'left-0'
											} w-56 bg-white rounded-lg shadow-xl border border-gray-300 overflow-hidden`}
											style={{ maxHeight: customization.position.includes('bottom') ? '480px' : '470px' }}>
											{/* Chat Header */}
											<div
												className="p-2.5 text-white"
												style={{ backgroundColor: customization.color }}>
												<h3 className="font-medium text-xs truncate">
													{customization.title}
												</h3>
												<p className="text-[10px] opacity-90">Online now</p>
											</div>

											{/* Chat Content */}
											<div className="p-2.5 space-y-2 h-32 overflow-y-auto bg-gray-50">
												<div className="flex items-start space-x-1.5">
													<div
														className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
														style={{ backgroundColor: customization.color }}>
														AI
													</div>
													<div className="bg-white rounded-lg p-1.5 flex-1 min-w-0 shadow-sm border border-gray-200">
														<p className="text-[10px] text-gray-800 leading-relaxed">
															{customization.greeting}
														</p>
													</div>
												</div>
											</div>

											{/* Input */}
											<div className="border-t p-2.5 bg-white">
												<div className="flex items-center space-x-1.5">
													<input
														type="text"
														placeholder={customization.placeholder}
														className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-[10px] focus:outline-none focus:border-gray-400"
														disabled
													/>
													<button
														className="p-1.5 rounded text-white"
														style={{
															backgroundColor: customization.color,
														}}>
														<SendIcon className="w-3 h-3" />
													</button>
												</div>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

// Icons
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
			d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.240.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
		/>
	</svg>
);

const CopyIcon = ({ className }) => (
	<svg
		className={className}
		fill="none"
		viewBox="0 0 24 24"
		strokeWidth={1.5}
		stroke="currentColor">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184"
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

const SendIcon = ({ className }) => (
	<svg
		className={className}
		fill="none"
		viewBox="0 0 24 24"
		strokeWidth={1.5}
		stroke="currentColor">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"
		/>
	</svg>
);
