import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import connectDB from '@/lib/mongo';
import User from '@/models/User';

export async function POST(request) {
  // Get the headers
  const headerPayload = headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new NextResponse('Error occurred -- no svix headers', {
      status: 400,
    });
  }

  // Get the body
  const payload = await request.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret.
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET);

  let evt;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    });
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new NextResponse('Error occurred', {
      status: 400,
    });
  }

  // Handle the webhook
  const { id } = evt.data;
  const eventType = evt.type;

  console.log(`Webhook with and ID of ${id} and type of ${eventType}`);
  console.log('Webhook body:', body);

  try {
    await connectDB();

    switch (eventType) {
      case 'user.created':
      case 'user.updated':
        await handleUserCreatedOrUpdated(evt.data);
        break;
      case 'user.deleted':
        await handleUserDeleted(evt.data);
        break;
      default:
        console.log(`Unhandled event type: ${eventType}`);
    }

    return new NextResponse('Success', { status: 200 });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new NextResponse('Error occurred', { status: 500 });
  }
}

async function handleUserCreatedOrUpdated(data) {
  const {
    id: clerkId,
    email_addresses,
    first_name,
    last_name,
    created_at,
  } = data;

  // Get primary email
  const primaryEmail = email_addresses.find(email => email.id === data.primary_email_address_id);
  const email = primaryEmail?.email_address;

  if (!email) {
    console.error('No email found for user:', clerkId);
    return;
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ clerkId });

    if (existingUser) {
      // Update existing user
      await User.findOneAndUpdate(
        { clerkId },
        {
          email,
          firstName: first_name || '',
          lastName: last_name || '',
        },
        { new: true }
      );
      console.log('User updated:', clerkId);
    } else {
      // Create new user
      const newUser = new User({
        clerkId,
        email,
        firstName: first_name || '',
        lastName: last_name || '',
        plan: 'free',
        subscription: {
          status: 'inactive',
        },
        usage: {
          botsCreated: 0,
          messagesThisMonth: 0,
          storageUsed: 0,
          lastResetDate: new Date(),
        },
        limits: {
          maxBots: 1, // Free plan
          maxMessages: 100, // Free plan
          maxStorage: 50 * 1024 * 1024, // 50MB
        },
        preferences: {
          emailNotifications: true,
          marketingEmails: false,
        },
      });

      await newUser.save();
      console.log('New user created:', clerkId);
    }
  } catch (error) {
    console.error('Error creating/updating user:', error);
    throw error;
  }
}

async function handleUserDeleted(data) {
  const { id: clerkId } = data;

  try {
    // Delete user and related data
    await User.findOneAndDelete({ clerkId });
    
    // Note: You might want to also clean up related bots, files, etc.
    // This depends on your business requirements
    console.log('User deleted:', clerkId);
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}