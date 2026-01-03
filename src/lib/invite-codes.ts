/**
 * Invite code management utilities
 */

import db from './db-client'
import { EXPANSION_EPOCHS, ADMIN_CODES_PER_EPOCH, USER_CODES_PER_EPOCH } from './constants'

// Cache for epoch data to prevent rate limit issues
let epochCache: { timestamp: number; value: number } | null = null
const EPOCH_CACHE_DURATION = 30000 // 30 seconds

/**
 * Generate a unique invite code
 */
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = 'HC-'
  
  for (let i = 0; i < 12; i++) {
    if (i === 4 || i === 8) {
      code += '-'
    }
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  
  return code
}

/**
 * Get current epoch based on total user count (cached to prevent rate limits)
 */
export async function getCurrentEpoch(): Promise<number> {
  try {
    // Check if cache is still valid
    if (epochCache && Date.now() - epochCache.timestamp < EPOCH_CACHE_DURATION) {
      return epochCache.value
    }

    // Fetch minimal user count data
    const allUsers = await db.db.users.list({ limit: 1000 })
    const userCount = allUsers.length

    // Find the current epoch threshold
    let currentEpoch = EXPANSION_EPOCHS[EXPANSION_EPOCHS.length - 1]
    for (const epoch of EXPANSION_EPOCHS) {
      if (userCount < epoch) {
        currentEpoch = epoch
        break
      }
    }

    // Update cache
    epochCache = { timestamp: Date.now(), value: currentEpoch }
    return currentEpoch
  } catch (error) {
    console.error('Failed to get current epoch:', error)
    // Return cached value if available, otherwise default
    if (epochCache) {
      return epochCache.value
    }
    return EXPANSION_EPOCHS[0]
  }
}

/**
 * Check if we've reached a new epoch and need to grant codes
 */
export async function checkEpochTransition(previousCount: number, currentCount: number): Promise<boolean> {
  for (const epoch of EXPANSION_EPOCHS) {
    if (previousCount < epoch && currentCount >= epoch) {
      return true
    }
  }
  return false
}

/**
 * Grant invite codes to a user for reaching a new epoch
 * Only the admin user "jcb" can generate invite codes
 */
export async function grantEpochInviteCodes(userId: string, isAdmin: boolean = false, maxUses: number = 1): Promise<void> {
  // Verify the user is jcb
  try {
    const userRecords = await db.db.users.list({
      where: { id: userId }
    })
    
    if (userRecords.length === 0) {
      throw new Error('User not found')
    }
    
    const user = userRecords[0]
    if (user.username !== 'jcb') {
      throw new Error('Only the admin user "jcb" can generate invite codes')
    }
  } catch (error) {
    console.error('Authorization check failed:', error)
    throw error
  }

  const codeCount = isAdmin ? ADMIN_CODES_PER_EPOCH : USER_CODES_PER_EPOCH

  for (let i = 0; i < codeCount; i++) {
    const code = generateInviteCode()

    try {
      await db.db.inviteCodes.create({
        id: `ic_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        code,
        createdBy: userId,
        used: 0,
        usedBy: null,
        usedAt: null,
        createdAt: new Date().toISOString(),
        maxUses: maxUses,
        usesCount: 0
      })
    } catch (error) {
      console.error('Failed to create invite code:', error)
    }
  }
}

/**
 * Grant codes to all existing users when reaching a new epoch
 */
export async function grantEpochCodesToAllUsers(): Promise<void> {
  try {
    const allUsers = await db.db.users.list()

    for (const user of allUsers) {
      const isAdmin = Number(user.isAdmin) > 0
      await grantEpochInviteCodes(user.id, isAdmin)
    }
  } catch (error) {
    console.error('Failed to grant codes to all users:', error)
  }
}

/**
 * Validate an invite code
 */
export async function validateInviteCode(code: string): Promise<{ valid: boolean; message: string; codeId?: string; inviteCode?: any }> {
  try {
    const inviteCodes = await db.db.inviteCodes.list({
      where: { code }
    })

    if (inviteCodes.length === 0) {
      return { valid: false, message: 'Invalid invite code' }
    }

    const inviteCode = inviteCodes[0]
    const maxUses = Number(inviteCode.maxUses) || 1
    const usesCount = Number(inviteCode.usesCount) || 0

    // Check if code has reached max uses
    if (usesCount >= maxUses) {
      return { valid: false, message: `This invite code has reached its maximum uses (${maxUses}/${maxUses})` }
    }

    // Legacy check for old codes without maxUses field
    if (Number(inviteCode.used) > 0 && maxUses === 1) {
      return { valid: false, message: 'This invite code has already been used' }
    }

    return {
      valid: true,
      message: `Valid invite code (${usesCount + 1}/${maxUses} uses)`,
      codeId: inviteCode.id,
      inviteCode: inviteCode
    }
  } catch (error) {
    console.error('Failed to validate invite code:', error)
    return { valid: false, message: 'Failed to validate invite code' }
  }
}

/**
 * Mark an invite code as used (increment uses_count)
 */
export async function markInviteCodeAsUsed(codeId: string, userId: string): Promise<void> {
  try {
    // Get current invite code
    const inviteCodes = await db.db.inviteCodes.list({
      where: { id: codeId }
    })

    if (inviteCodes.length === 0) {
      console.error('Invite code not found:', codeId)
      return
    }

    const inviteCode = inviteCodes[0]
    const currentUsesCount = Number(inviteCode.usesCount) || 0
    const maxUses = Number(inviteCode.maxUses) || 1
    const newUsesCount = currentUsesCount + 1

    // Update the invite code
    await db.db.inviteCodes.update(codeId, {
      usesCount: newUsesCount,
      // Mark as fully used if we've reached max uses
      used: newUsesCount >= maxUses ? 1 : 0,
      usedBy: userId,
      usedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Failed to mark invite code as used:', error)
  }
}

/**
 * Get invite codes for a user
 */
export async function getUserInviteCodes(userId: string): Promise<any[]> {
  try {
    return await db.db.inviteCodes.list({
      where: { createdBy: userId },
      orderBy: { createdAt: 'desc' }
    })
  } catch (error) {
    console.error('Failed to get user invite codes:', error)
    return []
  }
}