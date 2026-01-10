import {
	ClerkProvider,
	SignInButton,
	SignUpButton,
	SignedIn,
	SignedOut,
	UserButton,
} from '@clerk/nextjs';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY } from '@/lib/utils/envConfig';

const geistSans = Geist({
	variable: '--font-geist-sans',
	subsets: ['latin'],
});

const geistMono = Geist_Mono({
	variable: '--font-geist-mono',
	subsets: ['latin'],
});

export const metadata = {
	title: 'PlugRAG - Plug-and-Play RAG Chatbots',
	description: 'Create intelligent chatbots in minutes. Upload your content, customize the design, and embed anywhere. Powered by OpenAI and advanced retrieval technology.',
};

// Force dynamic rendering to prevent build-time issues with Clerk and database connections
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }) {
	return (
		<ClerkProvider publishableKey={NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
			<html lang="en" className="dark">
				<body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-gray-100`}>
					{children}
				</body>
			</html>
		</ClerkProvider>
	);
}
