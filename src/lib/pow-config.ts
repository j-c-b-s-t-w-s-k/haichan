/**
 * Dynamic Proof-of-Work Configuration
 * Allows dynamic adjustment of PoW difficulty via prefix and point mapping
 */

export interface PowLevel {
  name: string
  prefix: string
  points: number
  description: string
}

export interface PowConfig {
  levels: PowLevel[]
  currentPrefix: string
  currentPoints: number
}

/**
 * Preset PoW configurations
 * Can be mixed and matched for different difficulty levels
 */
export const POW_PRESETS = {
  EASY: {
    name: 'Easy',
    prefix: '21',
    points: 4,
    description: 'Hash starting with 21 (easiest)'
  },
  MODERATE: {
    name: 'Moderate',
    prefix: '21e',
    points: 8,
    description: 'Hash starting with 21e'
  },
  STANDARD: {
    name: 'Standard',
    prefix: '21e8',
    points: 15,
    description: 'Hash starting with 21e8 (default)'
  },
  HARD: {
    name: 'Hard',
    prefix: '21e80',
    points: 60,
    description: 'Hash starting with 21e80'
  },
  VERY_HARD: {
    name: 'Very Hard',
    prefix: '21e800',
    points: 240,
    description: 'Hash starting with 21e800'
  },
  EXTREME: {
    name: 'Extreme',
    prefix: '21e8000',
    points: 960,
    description: 'Hash starting with 21e8000'
  },
  LEGENDARY: {
    name: 'Legendary',
    prefix: '21e80000',
    points: 3840,
    description: 'Hash starting with 21e80000'
  }
}

/**
 * Default PoW level - uses 21e8 standard
 */
export const DEFAULT_POW_LEVEL = POW_PRESETS.STANDARD

/**
 * Get point value for a given prefix
 * Formula: 15 * 4^(extra_zeros)
 */
export function getPointsForPrefix(prefix: string): number {
  const match = prefix.match(/^21e?0*$/)
  if (!match) return 0

  // Count zeros after the base prefix
  const basePrefix = '21e8'
  if (prefix === '21') return 4
  if (prefix === '21e') return 8
  if (prefix === basePrefix) return 15

  // For 21e8 + trailing zeros
  if (prefix.startsWith('21e8')) {
    const extraZeros = prefix.length - 4
    return 15 * Math.pow(4, extraZeros)
  }

  return 0
}

/**
 * Get all available PoW levels
 */
export function getAllPowLevels(): PowLevel[] {
  return Object.values(POW_PRESETS)
}

/**
 * Find a PoW level by prefix
 */
export function getPowLevelByPrefix(prefix: string): PowLevel | null {
  return Object.values(POW_PRESETS).find(level => level.prefix === prefix) || null
}

/**
 * Find a PoW level by points
 */
export function getPowLevelByPoints(points: number): PowLevel | null {
  return Object.values(POW_PRESETS).find(level => level.points === points) || null
}

/**
 * Validate a custom prefix
 * Valid patterns: 21, 21e, 21e8, 21e80, 21e800, etc.
 */
export function isValidPowPrefix(prefix: string): boolean {
  return /^21e?0*$/.test(prefix) && prefix.length > 0
}

/**
 * Create a custom PoW level
 */
export function createCustomPowLevel(prefix: string, name?: string): PowLevel | null {
  if (!isValidPowPrefix(prefix)) return null

  return {
    name: name || `Custom (${prefix})`,
    prefix,
    points: getPointsForPrefix(prefix),
    description: `Hash starting with ${prefix}`
  }
}

/**
 * Get PoW level from localStorage
 */
export function getSavedPowLevel(): PowLevel {
  try {
    const saved = localStorage.getItem('pow_level')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed.prefix && isValidPowPrefix(parsed.prefix)) {
        return parsed as PowLevel
      }
    }
  } catch (error) {
    console.warn('Failed to load PoW level from localStorage:', error)
  }
  return DEFAULT_POW_LEVEL
}

/**
 * Save PoW level to localStorage
 */
export function savePowLevel(level: PowLevel): void {
  try {
    localStorage.setItem('pow_level', JSON.stringify(level))
  } catch (error) {
    console.warn('Failed to save PoW level to localStorage:', error)
  }
}

/**
 * Calculate required difficulty based on thread reply count
 * - 0-9 replies: Standard (21e8, 15 pts)
 * - 10-49 replies: Hard (21e80, 60 pts) - 4x harder
 * - 50-99 replies: Very Hard (21e800, 240 pts) - 16x harder
 * - 100+ replies: Extreme (21e8000, 960 pts) - 64x harder
 */
export function calculateThreadDifficulty(replyCount: number): { prefix: string, points: number } {
  if (replyCount >= 100) return { prefix: POW_PRESETS.EXTREME.prefix, points: POW_PRESETS.EXTREME.points }
  if (replyCount >= 50) return { prefix: POW_PRESETS.VERY_HARD.prefix, points: POW_PRESETS.VERY_HARD.points }
  if (replyCount >= 10) return { prefix: POW_PRESETS.HARD.prefix, points: POW_PRESETS.HARD.points }
  return { prefix: POW_PRESETS.STANDARD.prefix, points: POW_PRESETS.STANDARD.points }
}

/**
 * Calculate thread lock status
 * Thread locks if > 100 posts AND total_pow < replyCount * 1000
 */
export function isThreadLocked(replyCount: number, totalPow: number): boolean {
  if (replyCount < 100) return false
  return totalPow < (replyCount * 1000)
}
