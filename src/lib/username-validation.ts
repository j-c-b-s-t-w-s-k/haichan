/**
 * Username validation utilities
 */

import db from './db-client'
import { USERNAME_REGEX, MIN_USERNAME_LENGTH, MAX_USERNAME_LENGTH } from './constants'

export interface UsernameValidationResult {
  valid: boolean
  message: string
}

/**
 * Check if username looks like an email address
 */
function looksLikeEmail(username: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)
}

/**
 * Validate username format and availability
 */
export async function validateUsername(username: string): Promise<UsernameValidationResult> {
  // Check length
  if (username.length < MIN_USERNAME_LENGTH) {
    return {
      valid: false,
      message: `Username must be at least ${MIN_USERNAME_LENGTH} characters`
    }
  }
  
  if (username.length > MAX_USERNAME_LENGTH) {
    return {
      valid: false,
      message: `Username must be no more than ${MAX_USERNAME_LENGTH} characters`
    }
  }
  
  // Check format (alphanumeric only)
  if (!USERNAME_REGEX.test(username)) {
    return {
      valid: false,
      message: 'Username can only contain letters and numbers'
    }
  }
  
  // Check if username looks like an email
  if (looksLikeEmail(username)) {
    return {
      valid: false,
      message: 'Username cannot look like an email address'
    }
  }
  
  // Check for duplicates (case-insensitive)
  // Exception: "Anonymous" is allowed
  if (username.toLowerCase() === 'anonymous') {
    return {
      valid: true,
      message: 'Username is available'
    }
  }

  try {
    const existingUsers = await db.db.users.list({
      where: { username: username.toLowerCase() },
      limit: 1
    })
    
    if (existingUsers.length > 0) {
      return {
        valid: false,
        message: 'Username already taken'
      }
    }
  } catch (error) {
    console.error('Failed to check username availability:', error)
    return {
      valid: false,
      message: 'Failed to validate username'
    }
  }
  
  return {
    valid: true,
    message: 'Username is available'
  }
}

/**
 * Sanitize username input (remove invalid characters)
 */
export function sanitizeUsername(username: string): string {
  return username.replace(/[^A-Za-z0-9]/g, '')
}

/**
 * Format username for display
 */
export function formatUsername(username: string): string {
  return username.trim() || 'Anonymous'
}
