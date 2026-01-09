'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { botAPI, apiUtils } from '@/lib/clientAPI';

export default function CreateBot() {
	const router = useRouter();

	const [formData, setFormData] = useState({
		name: '',
		description: '',
		embedColor: '#f97316',
		embedPosition: 'bottom-right',
		greeting: 'Hello! How can I help you today?',
		placeholder: 'Type your message...',
		title: 'Chat Assistant',
	});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState(null);
	const [createdBot, setCreatedBot] = useState(null);

	const handleInputChange = (e) => {
		const { name, value } = e.target;
		setFormData((prev) => ({
			...prev,
			[name]: value,
		}));
	};

	// Simplified bot creation - no file upload during creation

	const handleSubmit = async (e) => {
		e.preventDefault();
		setIsSubmitting(true);
		setError(null);

		try {
			// Create the bot - files will be uploaded later after API key setup
			console.log('Creating bot...');
			const botResponse = await botAPI.create({
				name: formData.name,
				description: formData.description,
				customization: {
					bubbleColor: formData.embedColor,
					position: formData.embedPosition,
					greeting: formData.greeting,
					placeholder: formData.placeholder,
					title: formData.title,
				},
			});

			console.log('Bot created successfully:', botResponse.data);
			setCreatedBot(botResponse.data);

			// Redirect to the individual bot page for API key setup and file upload
			setTimeout(() => {
				router.push(`/dashboard/bots/${botResponse.data.id}`);
			}, 2000);
		} catch (error) {
			console.error('Error creating bot:', error);
			setError(apiUtils.formatError(error));
			setCreatedBot(null);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<DashboardLayout>
			<div className="max-w-4xl mx-auto space-y-8">
				{/* Header */}
				<div>
					<h1 className="text-2xl font-bold text-white">Create New Bot</h1>
					<p className="mt-2 text-gray-200">
						Set up a new chatbot with your custom content
					</p>
				</div>

				{/* Error Message */}
				{error && (
					<div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
						<div className="flex items-center space-x-2">
							<div className="w-5 h-5 text-red-500">
								<ErrorIcon />
							</div>
							<p className="text-red-200 font-medium">Error creating bot</p>
						</div>
						<p className="text-red-300 text-sm mt-1">{error}</p>
					</div>
				)}

				{/* Success Message */}
				{createdBot && (
					<div className="bg-green-900/20 border border-green-800 rounded-lg p-4">
						<div className="flex items-center space-x-2">
							<div className="w-5 h-5 text-green-500">
								<CheckIcon />
							</div>
							<p className="text-green-200 font-medium">
								Bot created successfully!
							</p>
						</div>
						<p className="text-green-300 text-sm mt-1">
							Redirecting to bot setup page to configure API key and upload
							files...
						</p>
					</div>
				)}

				<form onSubmit={handleSubmit} className="space-y-8">
					{/* Basic Information */}
					<div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
						<h2 className="text-lg font-medium text-white mb-4">
							Basic Information
						</h2>
						<div className="space-y-4">
							<div>
								<label
									htmlFor="name"
									className="block text-sm font-medium text-gray-200 mb-1">
									Bot Name *
								</label>
								<input
									type="text"
									id="name"
									name="name"
									value={formData.name}
									onChange={handleInputChange}
									required
									className="w-full px-3 py-2 border border-gray-700 bg-gray-800 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
									placeholder="e.g., Customer Support Bot"
								/>
							</div>
							<div>
								<label
									htmlFor="description"
									className="block text-sm font-medium text-gray-200 mb-1">
									Description *
								</label>
								<textarea
									id="description"
									name="description"
									value={formData.description}
									onChange={handleInputChange}
									required
									rows={3}
									className="w-full px-3 py-2 border border-gray-700 bg-gray-800 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
									placeholder="Describe what this bot will help with..."
								/>
							</div>
						</div>
					</div>

					{/* Embed Customization */}
					<div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
						<h2 className="text-lg font-medium text-white mb-4">
							Embed Customization
						</h2>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							<div>
								<label
									htmlFor="embedColor"
									className="block text-sm font-medium text-gray-200 mb-1">
									Theme Color
								</label>
								<div className="flex items-center space-x-3">
									<input
										type="color"
										id="embedColor"
										name="embedColor"
										value={formData.embedColor}
										onChange={handleInputChange}
										className="w-12 h-10 border border-gray-700 rounded-lg cursor-pointer"
									/>
									<input
										type="text"
										value={formData.embedColor}
										onChange={handleInputChange}
										name="embedColor"
										className="flex-1 px-3 py-2 border border-gray-700 bg-gray-800 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
									/>
								</div>
							</div>
							<div>
								<label
									htmlFor="embedPosition"
									className="block text-sm font-medium text-gray-200 mb-1">
									Position
								</label>
								<select
									id="embedPosition"
									name="embedPosition"
									value={formData.embedPosition}
									onChange={handleInputChange}
									className="w-full px-3 py-2 border border-gray-700 bg-gray-800 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent">
									<option value="bottom-right">Bottom Right</option>
									<option value="bottom-left">Bottom Left</option>
									<option value="top-right">Top Right</option>
									<option value="top-left">Top Left</option>
								</select>
							</div>
						</div>

						<div className="space-y-4 mt-4">
							<div>
								<label
									htmlFor="title"
									className="block text-sm font-medium text-gray-200 mb-1">
									Chat Title
								</label>
								<input
									type="text"
									id="title"
									name="title"
									value={formData.title}
									onChange={handleInputChange}
									maxLength={50}
									className="w-full px-3 py-2 border border-gray-700 bg-gray-800 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
									placeholder="e.g., Chat Assistant"
								/>
								<p className="text-xs text-gray-400 mt-1">
									This appears at the top of the chat widget
								</p>
							</div>
							<div>
								<label
									htmlFor="greeting"
									className="block text-sm font-medium text-gray-200 mb-1">
									Greeting Message
								</label>
								<input
									type="text"
									id="greeting"
									name="greeting"
									value={formData.greeting}
									onChange={handleInputChange}
									maxLength={200}
									className="w-full px-3 py-2 border border-gray-700 bg-gray-800 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
									placeholder="e.g., Hello! How can I help you today?"
								/>
								<p className="text-xs text-gray-400 mt-1">
									Initial message shown when chat opens
								</p>
							</div>
							<div>
								<label
									htmlFor="placeholder"
									className="block text-sm font-medium text-gray-200 mb-1">
									Input Placeholder
								</label>
								<input
									type="text"
									id="placeholder"
									name="placeholder"
									value={formData.placeholder}
									onChange={handleInputChange}
									maxLength={100}
									className="w-full px-3 py-2 border border-gray-700 bg-gray-800 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
									placeholder="e.g., Type your message..."
								/>
								<p className="text-xs text-gray-400 mt-1">
									Placeholder text in the message input field
								</p>
							</div>
						</div>

						{/* Preview */}
						<div className="mt-6">
							<h3 className="text-sm font-medium text-gray-200 mb-3">
								Preview
							</h3>
							<div className="relative bg-gray-800 rounded-lg p-4 h-32 overflow-hidden">
								<div className="text-xs text-gray-300 mb-2">
									Your website content here...
								</div>
								<div
									className={`absolute ${
										formData.embedPosition === 'bottom-right'
											? 'bottom-4 right-4'
											: formData.embedPosition === 'bottom-left'
											? 'bottom-4 left-4'
											: formData.embedPosition === 'top-right'
											? 'top-4 right-4'
											: 'top-4 left-4'
									} w-12 h-12 rounded-full shadow-lg flex items-center justify-center cursor-pointer`}
									style={{ backgroundColor: formData.embedColor }}>
									<ChatIcon className="w-6 h-6 text-white" />
								</div>
							</div>
						</div>
					</div>

					{/* Next Steps Information */}
					<div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
						<h2 className="text-lg font-medium text-white mb-4">
							Next Steps After Creation
						</h2>
						<div className="space-y-3">
							<div className="flex items-start space-x-3">
								<div className="flex-shrink-0 w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
									1
								</div>
								<div>
									<h3 className="text-sm font-medium text-white">
										Configure OpenAI API Key
									</h3>
									<p className="text-sm text-gray-300">
										Set up your custom OpenAI API key for this bot to enable AI
										responses and file processing.
									</p>
								</div>
							</div>
							<div className="flex items-start space-x-3">
								<div className="flex-shrink-0 w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
									2
								</div>
								<div>
									<h3 className="text-sm font-medium text-white">
										Upload Knowledge Base
									</h3>
									<p className="text-sm text-gray-300">
										Upload PDF, DOCX, TXT, CSV, or HTML files that your bot will
										use to answer questions.
									</p>
								</div>
							</div>
							<div className="flex items-start space-x-3">
								<div className="flex-shrink-0 w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
									3
								</div>
								<div>
									<h3 className="text-sm font-medium text-white">
										Test & Deploy
									</h3>
									<p className="text-sm text-gray-300">
										Test your bot's responses and get the embed code to add it
										to your website.
									</p>
								</div>
							</div>
						</div>
						<div className="mt-4 p-3 bg-blue-900/20 border border-blue-800 rounded-lg">
							<div className="flex items-start space-x-2">
								<InfoIcon className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
								<div>
									<p className="text-blue-200 text-sm font-medium">
										Why API Keys First?
									</p>
									<p className="text-blue-300 text-sm">
										Each bot uses its own OpenAI API key for security and cost
										isolation. This ensures your usage and costs are separate
										for each bot.
									</p>
								</div>
							</div>
						</div>
					</div>

					{/* Actions */}
					<div className="flex justify-end space-x-4">
						<button
							type="button"
							onClick={() => router.back()}
							className="px-6 py-2 border border-gray-700 text-gray-200 rounded-lg hover:bg-gray-700 font-medium transition-colors">
							Cancel
						</button>
						<button
							type="submit"
							disabled={
								isSubmitting ||
								createdBot ||
								!formData.name ||
								!formData.description
							}
							className="px-6 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors flex items-center space-x-2">
							{isSubmitting && <LoadingIcon className="w-4 h-4 animate-spin" />}
							{createdBot && <CheckIcon className="w-4 h-4" />}
							<span>
								{createdBot
									? 'Bot Created!'
									: isSubmitting
									? 'Creating Bot...'
									: 'Create Bot'}
							</span>
						</button>
					</div>
				</form>
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

const LoadingIcon = ({ className }) => (
	<svg className={className} fill="none" viewBox="0 0 24 24">
		<circle
			className="opacity-25"
			cx="12"
			cy="12"
			r="10"
			stroke="currentColor"
			strokeWidth="4"></circle>
		<path
			className="opacity-75"
			fill="currentColor"
			d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
	</svg>
);

const ErrorIcon = () => (
	<svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
		/>
	</svg>
);

const CheckIcon = () => (
	<svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
		/>
	</svg>
);

// Information icon for helpful tips
const InfoIcon = ({ className }) => (
	<svg
		className={className}
		fill="none"
		viewBox="0 0 24 24"
		strokeWidth={1.5}
		stroke="currentColor">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
		/>
	</svg>
);
