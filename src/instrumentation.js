/**
 * Next.js Instrumentation
 * This runs once when the server starts, allowing us to set up runtime configuration
 */

export async function register() {
	if (process.env.NEXT_RUNTIME === 'nodejs') {
		// Set Clerk environment variables at runtime for server
		const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
		const clerkSecretKey = process.env.CLERK_SECRET_KEY;

		if (clerkPublishableKey) {
			// Ensure NEXT_PUBLIC_* env var is available at runtime
			process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = clerkPublishableKey;
			console.log('✓ Clerk publishable key loaded at runtime');
		} else {
			console.warn('⚠ Warning: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY not found');
		}

		if (clerkSecretKey) {
			process.env.CLERK_SECRET_KEY = clerkSecretKey;
			console.log('✓ Clerk secret key loaded at runtime');
		} else {
			console.warn('⚠ Warning: CLERK_SECRET_KEY not found');
		}
	}
}
