/**
 * Public rotating invite codes system
 * Allows anyone to join for a limited time (36 hours)
 */

import db from './db-client'

// Configuration
const ROTATION_INTERVAL_MS = 4 * 60 * 60 * 1000 // 4 hours
const TOTAL_DURATION_MS = 36 * 60 * 60 * 1000 // 36 hours
const END_TIME = Date.now() + TOTAL_DURATION_MS

// Pool of public invite codes that rotate every 4 hours
const PUBLIC_INVITE_CODES = [
  'HC-OPEN-2024-JOIN',
  'HC-FREE-PASS-24HR',
  'HC-WELCOME-HERE',
  'HC-JOIN-NOW-FREE',
  'HC-PUBLIC-INVITE',
  'HC-OPEN-ACCESS-1',
  'HC-FREE-ENTRY-GO',
  'HC-WELCOME-2024',
  'HC-JOIN-TODAY-24'
]

/**
 * Get the current public invite code based on rotation schedule
 */
export function getCurrentPublicInviteCode(): string | null {
  // Check if we're still within the 36-hour window
  if (Date.now() > END_TIME) {
    return null
  }

  // Calculate which code to use based on current time
  const timeElapsed = Date.now() - (END_TIME - TOTAL_DURATION_MS)
  const rotationIndex = Math.floor(timeElapsed / ROTATION_INTERVAL_MS)
  const codeIndex = rotationIndex % PUBLIC_INVITE_CODES.length

  return PUBLIC_INVITE_CODES[codeIndex]
}

/**
 * Check if public invite codes are still active
 */
export function isPublicInviteActive(): boolean {
  return Date.now() < END_TIME
}

/**
 * Get time remaining for public invite period
 */
export function getTimeRemaining(): { hours: number; minutes: number; seconds: number } | null {
  if (Date.now() > END_TIME) {
    return null
  }

  const remaining = END_TIME - Date.now()
  const hours = Math.floor(remaining / (60 * 60 * 1000))
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000))
  const seconds = Math.floor((remaining % (60 * 1000)) / 1000)

  return { hours, minutes, seconds }
}

/**
 * Initialize public invite codes in database
 */
export async function initializePublicInviteCodes(): Promise<void> {
  try {
    for (const code of PUBLIC_INVITE_CODES) {
      // Check if code already exists
      const existing = await db.db.inviteCodes.list({ where: { code } })
      
      if (existing.length === 0) {
        // Create new public invite code with unlimited uses
        await db.db.inviteCodes.create({
          id: `ic_public_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          code,
          createdBy: 'system',
          used: 0,
          usedBy: null,
          usedAt: null,
          createdAt: new Date().toISOString(),
          maxUses: 999999, // Effectively unlimited
          usesCount: 0
        })
      } else {
        // Update existing code to have unlimited uses
        await db.db.inviteCodes.update(existing[0].id, {
          maxUses: 999999,
          used: 0 // Reset used flag
        })
      }
    }
    
    console.log('✓ Public invite codes initialized')
  } catch (error) {
    console.error('Failed to initialize public invite codes:', error)
  }
}

/**
 * Get a formatted message about the public invite code
 * Returns null after 36 hours - no free access message shown
 */
export function getPublicInviteMessage(): string | null {
  const code = getCurrentPublicInviteCode()
  const timeRemaining = getTimeRemaining()

  if (!code || !timeRemaining) {
    // 36-hour window has passed - no more free public access
    return null
  }

  return `PUBLIC ACCESS ENABLED! Use code: ${code} (${timeRemaining.hours}h ${timeRemaining.minutes}m remaining)`
}
