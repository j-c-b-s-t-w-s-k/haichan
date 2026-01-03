/**
 * Seed function for user account
 * Creates a user with real credentials and Bitcoin address
 */

import db from './db-client';
import { downloadBackup } from './backup';
import { isValidBitcoinAddress, getBitcoinAddressType } from './bitcoin';

interface SeedUserOptions {
  username: string;
  email: string;
  password: string; // Used only for authentication, never stored or logged
  bitcoinAddress: string;
  inviteCode?: string;
}

export async function seedJcbUser(options?: SeedUserOptions) {
  try {
    // Use provided options or require valid Bitcoin address
    if (!options?.bitcoinAddress) {
      throw new Error(
        'Real Bitcoin address required. No hardcoded addresses allowed.\n' +
        'Please provide a valid Bitcoin address (Legacy, SegWit, or Taproot).'
      );
    }

    if (!options?.username || options.username.trim().length === 0) {
      throw new Error('Username is required for seeding.');
    }

    const username = options.username;
    const email = options.email;
    const password = options.password;
    const bitcoinAddress = options.bitcoinAddress;
    const inviteCode = options.inviteCode || 'SEED-' + Date.now();

    console.log('🔧 Seeding user with credentials:');
    console.log(`  Username: ${username}`);
    console.log(`  Email: ${email}`);
    console.log(`  Bitcoin Address: ${bitcoinAddress}`);

    // Validate Bitcoin address
    const isValidAddress = await isValidBitcoinAddress(bitcoinAddress);
    if (!isValidAddress) {
      throw new Error('Invalid Bitcoin address for seeding');
    }

    // Check if user already exists
    const existingUsers = await db.db.users.list({
      where: { email },
      limit: 1
    });

    if (existingUsers && existingUsers.length > 0) {
      throw new Error(`User with email ${email} already exists`);
    }

    // Create user with Blink auth using the specified password
    console.log('📝 Creating user with Blink auth...');
    const user = await db.auth.signUp({
      email,
      password, // Using the specified password: @!Qtrin0pz
      displayName: username,
      metadata: {
        username,
        bitcoinAddress,
        addressType: getBitcoinAddressType(bitcoinAddress),
        isTestUser: true,
        seedDate: new Date().toISOString()
      }
    });

    if (!user?.id) {
      throw new Error('Failed to create user account');
    }

    console.log(`✓ User created with ID: ${user.id}`);
    
    // Small delay to ensure auth record is committed
    await new Promise(resolve => setTimeout(resolve, 200));

    // Update the user record with custom fields and set admin flag
    console.log('📝 Updating user database record...');
    await db.db.users.update(user.id, {
      username,
      bitcoinAddress,
      isAdmin: "1",
      twitterBadgeHolder: "1"
    });

    console.log('✓ User database record updated (admin privileges granted)');
    
    // Wait a moment for DB to settle
    await new Promise(resolve => setTimeout(resolve, 500));

    // Generate and download backup file
    console.log('💾 Generating backup file...');
    downloadBackup({
      username,
      email,
      userId: user.id,
      bitcoinAddress,
      registrationDate: new Date().toISOString(),
      inviteCode,
      totalPowPoints: 0,
      diamondLevel: 0,
      backupGeneratedAt: new Date().toISOString()
    });

    console.log('✅ User seeded successfully!');
    console.log('📋 Backup file downloaded with account details');
    console.log('🔑 Account Information:');
    console.log(`   Email: ${email}`);
    console.log(`   Username: ${username}`);
    console.log(`   Bitcoin Address: ${bitcoinAddress}`);
    console.log(`   User ID: ${user.id}`);
    
    return {
      success: true,
      user,
      credentials: {
        email,
        username,
        bitcoinAddress,
        userId: user.id
      }
    };

  } catch (error: any) {
    console.error('❌ Seeding failed:', error.message);
    throw new Error(`Failed to seed user: ${error.message}`);
  }
}
