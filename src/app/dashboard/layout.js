import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { checkUserExists, syncUserWithDB } from '@/lib/integrations/clerk';

/**
 * Dashboard Root Layout
 * Handles user authentication and DB sync once per session
 * All dashboard pages inherit this layout
 */
export default async function DashboardRootLayout({ children }) {
	// Check authentication
	const user = await currentUser();
	
	if (!user) {
		redirect('/sign-in');
	}

	// Ensure user exists in DB (only runs once when entering dashboard)
	const userExists = await checkUserExists(user.id);
	if (!userExists) {
		await syncUserWithDB(user.id);
	}

	// Render child pages without additional wrapper
	return <>{children}</>;
}
