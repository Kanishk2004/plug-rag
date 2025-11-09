import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongo';

/**
 * POST /api/webhooks/clerk - Handle Clerk webhooks
 */
export async function POST(request) {
  try {
    // Connect to database
    await connectDB();

    // TODO: Implement Clerk webhook handling logic
    return NextResponse.json(
      { message: 'Clerk webhook endpoint - implement your logic here' },
      { status: 501 }
    );
  } catch (error) {
    console.error('Clerk webhook API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}