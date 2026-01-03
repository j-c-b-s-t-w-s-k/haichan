import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a username or brand name by extracting the first part before any separator
 * Examples: "jcb.stwsk" -> "jcb", "user@example.com" -> "user", "alice" -> "alice"
 */
export function formatBrandName(input: string | undefined | null): string {
  if (!input) return 'user'
  
  // Remove email domain part (@example.com)
  const withoutDomain = input.split('@')[0]
  
  // Extract first part before dot (e.g., "jcb.stwsk" -> "jcb")
  const withoutDot = withoutDomain.split('.')[0]
  
  // Return the formatted name, fallback to 'user' if empty
  return withoutDot || 'user'
} 