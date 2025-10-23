import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';

export async function GET() {
  try {
    console.log('Test API called');
    
    // Test auth()
    const authResult = auth();
    console.log('Auth result:', authResult);
    
    // Test currentUser()
    const user = await currentUser();
    console.log('Current user:', user);
    
    return NextResponse.json({
      success: true,
      authResult,
      user: user ? {
        id: user.id,
        email: user.emailAddresses?.[0]?.emailAddress,
        firstName: user.firstName,
        lastName: user.lastName,
      } : null,
    });
  } catch (error) {
    console.error('Test API error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}