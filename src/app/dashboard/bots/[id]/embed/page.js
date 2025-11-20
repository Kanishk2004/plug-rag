'use client';
import { useState, useEffect, use } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';

export default function BotEmbedPage({ params }) {
	const resolvedParams = use(params);
	const botId = resolvedParams?.id;

	const [bot, setBot] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [saving, setSaving] = useState(false);

	const [customization, setCustomization] = useState({
		color: '#f97316',
		position: 'bottom-right',
		greeting: 'Hi! How can I help you today?',
		placeholder: 'Type your message...',
	});

	const [domains, setDomains] = useState([]);
	const [newDomain, setNewDomain] = useState('');

	const [copied, setCopied] = useState(false);

	// Fetch bot data
	useEffect(() => {
		if (!botId) return;

		const fetchBot = async () => {
			try {
				const response = await fetch(`/api/bots/${botId}`);
				const data = await response.json();

				if (data.success) {
					setBot(data.data);
					setDomains(data.data.domainWhitelist || []);
					// Initialize customization with bot data
					setCustomization({
						color: data.data.customization?.bubbleColor || '#f97316',
						position: data.data.customization?.position || 'bottom-right',
						greeting:
							data.data.customization?.greeting ||
							'Hi! How can I help you today?',
						placeholder:
							data.data.customization?.placeholder || 'Type your message...',
					});
				} else {
					setError(data.message || 'Failed to fetch bot data');
				}
			} catch (err) {
				console.error('Error fetching bot:', err);
				setError('Failed to load bot data');
			} finally {
				setLoading(false);
			}
		};

		fetchBot();
	}, [botId]);

	const handleCustomizationChange = (field, value) => {
		setCustomization((prev) => ({
			...prev,
			[field]: value,
		}));
	};

	const addDomain = async () => {
		if (!newDomain.trim()) return;

		// Basic domain validation
		const domainRegex = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
		if (!domainRegex.test(newDomain.trim())) {
			alert('Please enter a valid domain (e.g., example.com)');
			return;
		}

		const domain = newDomain.trim().toLowerCase();
		if (domains.includes(domain)) {
			alert('Domain already exists in whitelist');
			return;
		}

		setSaving(true);
		try {
			const response = await fetch(`/api/bots/${botId}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					domainWhitelist: [...domains, domain],
				}),
			});

			const data = await response.json();
			if (data.success) {
				setDomains([...domains, domain]);
				setNewDomain('');
			} else {
				alert(data.message || 'Failed to add domain');
			}
		} catch (err) {
			console.error('Error adding domain:', err);
			alert('Failed to add domain');
		} finally {
			setSaving(false);
		}
	};

	const removeDomain = async (domainToRemove) => {
		setSaving(true);
		try {
			const newDomains = domains.filter((d) => d !== domainToRemove);
			const response = await fetch(`/api/bots/${botId}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					domainWhitelist: newDomains,
				}),
			});

			const data = await response.json();
			if (data.success) {
				setDomains(newDomains);
			} else {
				alert(data.message || 'Failed to remove domain');
			}
		} catch (err) {
			console.error('Error removing domain:', err);
			alert('Failed to remove domain');
		} finally {
			setSaving(false);
		}
	};

	const generateEmbedCode = () => {
		const currentDomain =
			typeof window !== 'undefined'
				? window.location.origin
				: 'https://plugrag.com';

		return `<!-- PlugRAG Embed Code -->
<script>
  window.PlugRAGConfig = {
    botId: "${bot?.id || botId}",
    color: "${customization.color}",
    position: "${customization.position}",
    greeting: "${customization.greeting}",
    placeholder: "${customization.placeholder}",
    apiBase: "${currentDomain}"
  };
</script>
<script src="${currentDomain}/embed.js" async></script>`;
	};

	const copyToClipboard = async () => {
		try {
			await navigator.clipboard.writeText(generateEmbedCode());
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error('Failed to copy: ', err);
		}
	};

	if (loading) {
		return (
			<DashboardLayout>
				<div className="max-w-6xl mx-auto">
					<div className="flex items-center justify-center py-12">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
					</div>
				</div>
			</DashboardLayout>
		);
	}

	if (error) {
		return (
			<DashboardLayout>
				<div className="max-w-6xl mx-auto">
					<div className="bg-red-50 border border-red-200 rounded-lg p-6">
						<h2 className="text-lg font-medium text-red-800">Error</h2>
						<p className="mt-2 text-red-600">{error}</p>
					</div>
				</div>
			</DashboardLayout>
		);
	}

	if (!bot) {
		return (
			<DashboardLayout>
				<div className="max-w-6xl mx-auto">
					<div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
						<h2 className="text-lg font-medium text-gray-800">Bot Not Found</h2>
						<p className="mt-2 text-gray-600">
							The requested bot could not be found.
						</p>
					</div>
				</div>
			</DashboardLayout>
		);
	}

	return (
		<DashboardLayout>
			<div className="max-w-6xl mx-auto space-y-8">
				{/* Header */}
				<div>
					<h1 className="text-2xl font-bold text-white">
						Embed Code Generator
					</h1>
					<p className="mt-2 text-gray-200">
						Customize and generate embed code for{' '}
						<span className="font-medium">{bot.name}</span>
					</p>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
					{/* Left Column - Customization and Security */}
					<div className="space-y-6">
						{/* Domain Security */}
						<div className="bg-white rounded-lg border border-gray-200 p-6">
							<h2 className="text-lg font-medium text-gray-900 mb-4">
								Domain Security
							</h2>
							<p className="text-sm text-gray-600 mb-4">
								Control which domains can embed your chatbot. Leave empty to
								allow all domains.
							</p>

							<div className="space-y-3">
								<div className="flex space-x-2">
									<input
										type="text"
										value={newDomain}
										onChange={(e) => setNewDomain(e.target.value)}
										onKeyPress={(e) => e.key === 'Enter' && addDomain()}
										placeholder="example.com"
										className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
									/>
									<button
										onClick={addDomain}
										disabled={saving}
										className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 text-sm font-medium">
										Add
									</button>
								</div>

								{domains.length > 0 && (
									<div className="space-y-2">
										<p className="text-sm font-medium text-gray-700">
											Allowed Domains:
										</p>
										{domains.map((domain) => (
											<div
												key={domain}
												className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg">
												<span className="text-sm text-gray-700">{domain}</span>
												<button
													onClick={() => removeDomain(domain)}
													disabled={saving}
													className="text-red-600 hover:text-red-800 disabled:opacity-50">
													<TrashIcon className="w-4 h-4" />
												</button>
											</div>
										))}
									</div>
								)}

								{domains.length === 0 && (
									<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
										<p className="text-sm text-yellow-800">
											<strong>Warning:</strong> No domain restrictions set. The
											chatbot can be embedded on any website.
										</p>
									</div>
								)}
							</div>
						</div>

						{/* Customization Panel */}
						<div className="space-y-6">
							<div className="bg-white rounded-lg border border-gray-200 p-6">
								<h2 className="text-lg font-medium text-gray-900 mb-4">
									Customization
								</h2>

								<div className="space-y-4">
									{/* Color Picker */}
									<div>
										<label className="block text-sm font-medium text-gray-700 mb-2">
											Theme Color
										</label>
										<div className="flex items-center space-x-3">
											<input
												type="color"
												value={customization.color}
												onChange={(e) =>
													handleCustomizationChange('color', e.target.value)
												}
												className="w-12 h-10 border border-gray-300 rounded-lg cursor-pointer"
											/>
											<input
												type="text"
												value={customization.color}
												onChange={(e) =>
													handleCustomizationChange('color', e.target.value)
												}
												className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
											/>
										</div>
									</div>

									{/* Position */}
									<div>
										<label className="block text-sm font-medium text-gray-700 mb-2">
											Position
										</label>
										<div className="grid grid-cols-2 gap-2">
											<button
												type="button"
												onClick={() =>
													handleCustomizationChange('position', 'bottom-left')
												}
												className={`p-3 text-sm font-medium rounded-lg border transition-colors ${
													customization.position === 'bottom-left'
														? 'bg-orange-50 border-orange-200 text-orange-700'
														: 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
												}`}>
												Bottom Left
											</button>
											<button
												type="button"
												onClick={() =>
													handleCustomizationChange('position', 'bottom-right')
												}
												className={`p-3 text-sm font-medium rounded-lg border transition-colors ${
													customization.position === 'bottom-right'
														? 'bg-orange-50 border-orange-200 text-orange-700'
														: 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
												}`}>
												Bottom Right
											</button>
										</div>
									</div>

									{/* Greeting Message */}
									<div>
										<label className="block text-sm font-medium text-gray-700 mb-2">
											Greeting Message
										</label>
										<input
											type="text"
											value={customization.greeting}
											onChange={(e) =>
												handleCustomizationChange('greeting', e.target.value)
											}
											className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
											placeholder="Hi! How can I help you today?"
										/>
									</div>

									{/* Placeholder Text */}
									<div>
										<label className="block text-sm font-medium text-gray-700 mb-2">
											Input Placeholder
										</label>
										<input
											type="text"
											value={customization.placeholder}
											onChange={(e) =>
												handleCustomizationChange('placeholder', e.target.value)
											}
											className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
											placeholder="Type your message..."
										/>
									</div>
								</div>
							</div>

							{/* Embed Code */}
							<div className="bg-white rounded-lg border border-gray-200 p-6">
								<div className="flex justify-between items-center mb-4">
									<h2 className="text-lg font-medium text-gray-900">
										Embed Code
									</h2>
									<button
										onClick={copyToClipboard}
										className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
											copied
												? 'bg-green-100 text-green-700 border border-green-200'
												: 'bg-orange-100 text-orange-700 border border-orange-200 hover:bg-orange-200'
										}`}>
										{copied ? (
											<>
												<CheckIcon className="w-4 h-4 inline mr-1" />
												Copied!
											</>
										) : (
											<>
												<CopyIcon className="w-4 h-4 inline mr-1" />
												Copy Code
											</>
										)}
									</button>
								</div>

								<div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
									<pre className="text-sm text-gray-300 whitespace-pre-wrap">
										<code>{generateEmbedCode()}</code>
									</pre>
								</div>

								<div className="mt-4 text-sm text-gray-600">
									<p className="font-medium mb-2">Instructions:</p>
									<ol className="list-decimal list-inside space-y-1">
										<li>Copy the code above</li>
										<li>
											Paste it before the closing &lt;/body&gt; tag on your
											website
										</li>
										<li>The chatbot will appear automatically on your site</li>
									</ol>
								</div>
							</div>
						</div>

						{/* Preview */}
						<div className="space-y-6">
							<div className="bg-white rounded-lg border border-gray-200 p-6">
								<h2 className="text-lg font-medium text-gray-900 mb-4">
									Live Preview
								</h2>

								{/* Mock Website */}
								<div
									className="relative bg-gray-100 rounded-lg overflow-hidden"
									style={{ height: '500px' }}>
									{/* Mock Header */}
									<div className="bg-white border-b border-gray-200 p-4">
										<div className="flex items-center space-x-4">
											<div className="w-8 h-8 bg-gray-300 rounded"></div>
											<div className="space-y-1">
												<div className="w-24 h-3 bg-gray-300 rounded"></div>
												<div className="w-16 h-2 bg-gray-200 rounded"></div>
											</div>
										</div>
									</div>

									{/* Mock Content */}
									<div className="p-6 space-y-4">
										<div className="w-3/4 h-4 bg-gray-300 rounded"></div>
										<div className="w-full h-4 bg-gray-200 rounded"></div>
										<div className="w-2/3 h-4 bg-gray-200 rounded"></div>
										<div className="w-1/2 h-32 bg-gray-300 rounded mt-6"></div>
									</div>

									{/* Chat Widget */}
									<div
										className={`absolute ${
											customization.position === 'bottom-right'
												? 'bottom-6 right-6'
												: 'bottom-6 left-6'
										} transition-all duration-300`}>
										<div className="relative">
											{/* Chat Button */}
											<button
												className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-transform hover:scale-110"
												style={{ backgroundColor: customization.color }}>
												<ChatIcon className="w-6 h-6" />
											</button>

											{/* Chat Preview (always show for demo) */}
											<div className="absolute bottom-16 right-0 w-80 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
												{/* Chat Header */}
												<div
													className="p-4 text-white"
													style={{ backgroundColor: customization.color }}>
													<h3 className="font-medium">{bot.name}</h3>
													<p className="text-sm opacity-90">Online now</p>
												</div>

												{/* Chat Content */}
												<div className="p-4 space-y-3">
													<div className="flex items-start space-x-2">
														<div
															className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs"
															style={{ backgroundColor: customization.color }}>
															AI
														</div>
														<div className="bg-gray-100 rounded-lg p-3 flex-1">
															<p className="text-sm">
																{customization.greeting}
															</p>
														</div>
													</div>

													{/* Input */}
													<div className="border-t pt-3">
														<div className="flex items-center space-x-2">
															<input
																type="text"
																placeholder={customization.placeholder}
																className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
																disabled
															/>
															<button
																className="p-2 rounded-lg text-white"
																style={{
																	backgroundColor: customization.color,
																}}>
																<SendIcon className="w-4 h-4" />
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
			</div>
		</DashboardLayout>
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
			d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.240.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.740.194V21l4.155-4.155"
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

const TrashIcon = ({ className }) => (
	<svg
		className={className}
		fill="none"
		viewBox="0 0 24 24"
		strokeWidth={1.5}
		stroke="currentColor">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
		/>
	</svg>
);
