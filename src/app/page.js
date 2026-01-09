'use client';
import { SignedOut, SignInButton, SignUpButton, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
	const { isSignedIn, isLoaded } = useUser();
	const router = useRouter();

	useEffect(() => {
		if (isLoaded && isSignedIn) {
			router.push('/dashboard');
		}
	}, [isLoaded, isSignedIn, router]);

	// Show loading or landing page while checking auth status
	if (!isLoaded) {
		return (
			<div className="min-h-screen bg-white flex items-center justify-center">
				<div className="text-orange-500">Loading...</div>
			</div>
		);
	}

	// If user is signed in, don't render anything (redirect is happening)
	if (isSignedIn) {
		return null;
	}

	return (
		<SignedOut>
			<div className="min-h-screen bg-black">
				{/* Navigation */}
				<nav className="bg-black border-b border-gray-800">
					<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
						<div className="flex justify-between items-center h-16">
							{/* LOGO */}
							<div className="flex items-center space-x-2">
								<div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
									<span className="text-white font-bold text-lg">P</span>
								</div>
								<span className="text-2xl font-bold text-white">PlugRAG</span>
							</div>

							{/* Navigation Links */}
							<div className="hidden md:flex items-center space-x-8">
								<a
									href="#features"
									className="text-gray-300 hover:text-white transition-colors">
									Features
								</a>
								<a
									href="#how-it-works"
									className="text-gray-300 hover:text-white transition-colors">
									How it Works
								</a>
								<a
									href="#pricing"
									className="text-gray-300 hover:text-white transition-colors">
									Pricing
								</a>
								<SignInButton mode="modal">
									<button className="text-gray-300 hover:text-white transition-colors">
										Sign In
									</button>
								</SignInButton>
								<SignUpButton mode="modal">
									<button className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-medium transition-colors">
										Get Started
									</button>
								</SignUpButton>
							</div>
						</div>
					</div>
				</nav>

				{/* Hero Section */}
				<section className="py-20 bg-gradient-to-br from-black via-gray-900 to-black">
					<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
						<div className="text-center">
							<div className="mb-8">
								<span className="inline-block px-4 py-2 bg-orange-500/20 text-orange-400 rounded-full text-sm font-medium mb-6 border border-orange-500/30">
									🚀 Powered by OpenAI & Advanced RAG Technology
								</span>
								<h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
									Plug-and-Play
									<span className="text-orange-500 block">RAG Chatbots</span>
								</h1>
								<p className="text-xl text-gray-200 max-w-3xl mx-auto mb-10 leading-relaxed">
									Transform your documents into intelligent chatbots in minutes.
									Upload your content, customize the experience, and embed
									anywhere with a single line of code.
								</p>
							</div>

							<div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
								<SignUpButton mode="modal">
									<button className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-8 py-4 rounded-lg text-lg transition-all shadow-lg hover:shadow-xl transform hover:scale-105">
										Start Building Free
									</button>
								</SignUpButton>
								<button className="border-2 border-gray-700 hover:border-orange-500 text-gray-200 hover:text-orange-500 font-semibold px-8 py-4 rounded-lg text-lg transition-all bg-gray-900 hover:bg-gray-800">
									Watch Demo
								</button>
							</div>

							{/* Demo Preview */}
							<div className="relative max-w-4xl mx-auto">
								<div className="bg-gray-900 rounded-2xl shadow-2xl border border-gray-800 overflow-hidden">
									<div className="bg-black px-6 py-4 flex items-center space-x-2">
										<div className="w-3 h-3 bg-red-500 rounded-full"></div>
										<div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
										<div className="w-3 h-3 bg-green-500 rounded-full"></div>
										<div className="ml-4 text-gray-400 text-sm">
											your-website.com
										</div>
									</div>
									<div className="h-80 bg-gradient-to-br from-gray-800 to-black relative">
										<div className="p-6">
											<div className="w-3/4 h-4 bg-gray-700 rounded mb-4"></div>
											<div className="w-1/2 h-4 bg-gray-600 rounded mb-8"></div>
											<div className="w-2/3 h-20 bg-gray-700 rounded"></div>
										</div>
										<div className="absolute bottom-6 right-6">
											<div className="w-14 h-14 bg-orange-500 rounded-full shadow-lg flex items-center justify-center cursor-pointer transform hover:scale-110 transition-transform">
												<ChatIcon className="w-7 h-7 text-white" />
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</section>

				{/* Features Section */}
				<section id="features" className="py-20 bg-gray-900">
					<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
						<div className="text-center mb-16">
							<h2 className="text-4xl font-bold text-white mb-4">
								Everything you need to build intelligent chatbots
							</h2>
							<p className="text-xl text-gray-200 max-w-3xl mx-auto">
								From document upload to deployment, PlugRAG handles the
								complexity so you can focus on what matters.
							</p>
						</div>

						<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
							<FeatureCard
								icon={<UploadIcon />}
								title="Smart Document Processing"
								description="Upload PDFs, Word docs, text files, and more. Our AI automatically extracts and indexes your content for optimal retrieval."
							/>
							<FeatureCard
								icon={<BrainIcon />}
								title="Advanced RAG Technology"
								description="Powered by cutting-edge Retrieval-Augmented Generation for accurate, contextual responses based on your documents."
							/>
							<FeatureCard
								icon={<CustomizeIcon />}
								title="Complete Customization"
								description="Match your brand with custom colors, positioning, and messaging. Your chatbot, your style."
							/>
							<FeatureCard
								icon={<EmbedIcon />}
								title="One-Line Integration"
								description="Deploy anywhere with a single script tag. Works with any website, CMS, or platform."
							/>
							<FeatureCard
								icon={<AnalyticsIcon />}
								title="Real-time Analytics"
								description="Track conversations, user satisfaction, and performance with detailed analytics and insights."
							/>
							<FeatureCard
								icon={<SecurityIcon />}
								title="Enterprise Security"
								description="Your data stays secure with encryption, access controls, and compliance with industry standards."
							/>
						</div>
					</div>
				</section>

				{/* How it Works */}
				<section id="how-it-works" className="py-20 bg-black">
					<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
						<div className="text-center mb-16">
							<h2 className="text-4xl font-bold text-white mb-4">
								Get your chatbot live in 3 simple steps
							</h2>
							<p className="text-xl text-gray-200">
								No coding required. No complex setup. Just upload, customize,
								and deploy.
							</p>
						</div>

						<div className="grid md:grid-cols-3 gap-12">
							<StepCard
								number="1"
								title="Upload Your Content"
								description="Drag and drop your documents, manuals, FAQs, or any text-based content. We support all major file formats."
								icon={<DocumentIcon />}
							/>
							<StepCard
								number="2"
								title="Customize & Configure"
								description="Choose your colors, set the position, and configure the chatbot's personality and responses."
								icon={<SettingsIcon />}
							/>
							<StepCard
								number="3"
								title="Deploy Anywhere"
								description="Copy the embed code and paste it on your website. Your intelligent chatbot is now live and ready to help users."
								icon={<RocketIcon />}
							/>
						</div>
					</div>
				</section>

				{/* Pricing */}
				<section id="pricing" className="py-20 bg-gray-900">
					<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
						<div className="text-center mb-16">
							<h2 className="text-4xl font-bold text-white mb-4">
								Simple, transparent pricing
							</h2>
							<p className="text-xl text-gray-200">
								Start free and scale as you grow. No hidden fees.
							</p>
						</div>

						<div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
							<PricingCard
								name="Starter"
								price="Free"
								description="Perfect for trying out PlugRAG"
								features={[
									'1 chatbot',
									'Up to 10 documents',
									'100 messages/month',
									'Basic customization',
									'Community support',
								]}
								buttonText="Get Started"
								buttonStyle="border"
							/>
							<PricingCard
								name="Professional"
								price="$29"
								description="For growing businesses"
								features={[
									'5 chatbots',
									'Up to 100 documents',
									'2,000 messages/month',
									'Full customization',
									'Priority support',
									'Analytics dashboard',
								]}
								buttonText="Start Free Trial"
								buttonStyle="primary"
								popular={true}
							/>
							<PricingCard
								name="Enterprise"
								price="Custom"
								description="For large organizations"
								features={[
									'Unlimited chatbots',
									'Unlimited documents',
									'Unlimited messages',
									'White-label solution',
									'Dedicated support',
									'Custom integrations',
								]}
								buttonText="Contact Sales"
								buttonStyle="border"
							/>
						</div>
					</div>
				</section>

				{/* CTA Section */}
				<section className="py-20 bg-gradient-to-r from-orange-500 to-orange-600">
					<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
						<h2 className="text-4xl font-bold text-white mb-4">
							Ready to transform your customer support?
						</h2>
						<p className="text-xl text-orange-100 mb-8 max-w-2xl mx-auto">
							Join thousands of businesses already using PlugRAG to provide
							instant, accurate support to their customers.
						</p>
						<SignUpButton mode="modal">
							<button className="bg-white text-orange-600 font-semibold px-8 py-4 rounded-lg text-lg hover:bg-gray-100 transition-colors shadow-lg">
								Start Building for Free
							</button>
						</SignUpButton>
					</div>
				</section>

				{/* Footer */}
				<footer className="bg-black text-white py-12">
					<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
						<div className="grid md:grid-cols-4 gap-8">
							<div>
								<div className="flex items-center space-x-2 mb-4">
									<div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
										<span className="text-white font-bold">P</span>
									</div>
									<span className="text-xl font-bold">PlugRAG</span>
								</div>
								<p className="text-gray-300">
									Plug-and-play RAG chatbots for modern businesses.
								</p>
							</div>
							<div>
								<h3 className="font-semibold mb-4">Product</h3>
								<div className="space-y-2">
									<a
										href="#"
										className="text-gray-300 hover:text-white block transition-colors">
										Features
									</a>
									<a
										href="#"
										className="text-gray-300 hover:text-white block transition-colors">
										Pricing
									</a>
									<a
										href="#"
										className="text-gray-300 hover:text-white block transition-colors">
										Documentation
									</a>
								</div>
							</div>
							<div>
								<h3 className="font-semibold mb-4">Company</h3>
								<div className="space-y-2">
									<a
										href="#"
										className="text-gray-300 hover:text-white block transition-colors">
										About
									</a>
									<a
										href="#"
										className="text-gray-300 hover:text-white block transition-colors">
										Blog
									</a>
									<a
										href="#"
										className="text-gray-300 hover:text-white block transition-colors">
										Contact
									</a>
								</div>
							</div>
							<div>
								<h3 className="font-semibold mb-4">Support</h3>
								<div className="space-y-2">
									<a
										href="#"
										className="text-gray-300 hover:text-white block transition-colors">
										Help Center
									</a>
									<a
										href="#"
										className="text-gray-300 hover:text-white block transition-colors">
										Privacy Policy
									</a>
									<a
										href="#"
										className="text-gray-300 hover:text-white block transition-colors">
										Terms of Service
									</a>
								</div>
							</div>
						</div>
						<div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-300">
							<p>&copy; 2024 PlugRAG. All rights reserved.</p>
						</div>
					</div>
				</footer>
			</div>
		</SignedOut>
	);
}

// Components
const FeatureCard = ({ icon, title, description }) => (
	<div className="p-8 bg-black rounded-2xl border border-gray-800 shadow-sm hover:shadow-lg hover:border-gray-600 transition-all">
		<div className="w-14 h-14 bg-orange-500/20 rounded-xl flex items-center justify-center mb-6 text-orange-400 border border-orange-500/30">
			{icon}
		</div>
		<h3 className="text-xl font-semibold text-white mb-3">{title}</h3>
		<p className="text-gray-200 leading-relaxed">{description}</p>
	</div>
);

const StepCard = ({ number, title, description, icon }) => (
	<div className="text-center">
		<div className="relative mb-8">
			<div className="w-20 h-20 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto text-white mb-6">
				{icon}
			</div>
			<div className="absolute -top-2 -right-2 w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
				{number}
			</div>
		</div>
		<h3 className="text-2xl font-semibold text-white mb-4">{title}</h3>
		<p className="text-gray-200 leading-relaxed">{description}</p>
	</div>
);

const PricingCard = ({
	name,
	price,
	description,
	features,
	buttonText,
	buttonStyle,
	popular,
}) => (
	<div
		className={`relative p-8 rounded-2xl border-2 transition-all hover:shadow-lg ${
			popular
				? 'border-orange-500 bg-orange-500/10'
				: 'border-gray-800 bg-black'
		}`}>
		{popular && (
			<div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
				<span className="bg-orange-500 text-white px-4 py-1 rounded-full text-sm font-medium">
					Most Popular
				</span>
			</div>
		)}
		<div className="text-center mb-8">
			<h3 className="text-2xl font-semibold text-white mb-2">{name}</h3>
			<div className="mb-2">
				<span className="text-4xl font-bold text-white">{price}</span>
				{price !== 'Free' && price !== 'Custom' && (
					<span className="text-gray-200">/month</span>
				)}
			</div>
			<p className="text-gray-200">{description}</p>
		</div>
		<ul className="space-y-3 mb-8">
			{features.map((feature, index) => (
				<li key={index} className="flex items-center">
					<CheckIcon className="w-5 h-5 text-green-400 mr-3" />
					<span className="text-gray-200">{feature}</span>
				</li>
			))}
		</ul>
		<SignUpButton mode="modal">
			<button
				className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
					buttonStyle === 'primary'
						? 'bg-orange-500 hover:bg-orange-600 text-white'
						: 'border-2 border-gray-700 hover:border-orange-500 text-gray-200 hover:text-orange-500 bg-gray-900 hover:bg-gray-800'
				}`}>
				{buttonText}
			</button>
		</SignUpButton>
	</div>
);

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

const UploadIcon = () => (
	<svg
		className="w-7 h-7"
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

const BrainIcon = () => (
	<svg
		className="w-7 h-7"
		fill="none"
		viewBox="0 0 24 24"
		strokeWidth={1.5}
		stroke="currentColor">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
		/>
	</svg>
);

const CustomizeIcon = () => (
	<svg
		className="w-7 h-7"
		fill="none"
		viewBox="0 0 24 24"
		strokeWidth={1.5}
		stroke="currentColor">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42"
		/>
	</svg>
);

const EmbedIcon = () => (
	<svg
		className="w-7 h-7"
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

const AnalyticsIcon = () => (
	<svg
		className="w-7 h-7"
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

const SecurityIcon = () => (
	<svg
		className="w-7 h-7"
		fill="none"
		viewBox="0 0 24 24"
		strokeWidth={1.5}
		stroke="currentColor">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
		/>
	</svg>
);

const DocumentIcon = () => (
	<svg
		className="w-8 h-8"
		fill="none"
		viewBox="0 0 24 24"
		strokeWidth={1.5}
		stroke="currentColor">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
		/>
	</svg>
);

const SettingsIcon = () => (
	<svg
		className="w-8 h-8"
		fill="none"
		viewBox="0 0 24 24"
		strokeWidth={1.5}
		stroke="currentColor">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a6.759 6.759 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
		/>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
		/>
	</svg>
);

const RocketIcon = () => (
	<svg
		className="w-8 h-8"
		fill="none"
		viewBox="0 0 24 24"
		strokeWidth={1.5}
		stroke="currentColor">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
		/>
	</svg>
);

const CheckIcon = ({ className }) => (
	<svg
		className={className}
		fill="none"
		viewBox="0 0 24 24"
		strokeWidth={2}
		stroke="currentColor">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="m4.5 12.75 6 6 9-13.5"
		/>
	</svg>
);
