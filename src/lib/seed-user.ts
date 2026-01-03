/**
 * Seed test user - DEPRECATED
 * Note: This function is deprecated. Users must register with real Bitcoin addresses.
 * Use the registration page at /register instead
 */

import db from './db-client'

export async function seedTestUser() {
  throw new Error(
    'DEPRECATED: Seed function no longer works. Users must register with real Bitcoin addresses.\n\n' +
    'To create a test account:\n' +
    '1. Go to /admin/invites to generate an invite code\n' +
    '2. Get a real Bitcoin address (Legacy, SegWit, or Taproot)\n' +
    '3. Visit /register and enter your Bitcoin address\n\n' +
    'The system now validates real Bitcoin addresses and does not generate fake ones.'
  )
}
