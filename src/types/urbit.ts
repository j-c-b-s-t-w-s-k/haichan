/**
 * Urbit type definitions
 */

export interface UrbitConfig {
  starPatp: string
  bridgeUrl: string
  maxPlanets: number
}

export interface PlanetInfo {
  patp: string
  point: number
  sponsor: string
  spawned: boolean
  claimed: boolean
  claimedAt?: Date
  userId?: string
}

export interface PlanetInvite {
  code: string
  patp: string
  expiresAt: Date
  used: boolean
}

export interface UrbitDistributionStats {
  total: number
  spawned: number
  claimed: number
  available: number
}

// @p validation regex
export const PATP_REGEX = /^~[a-z]{6}(-[a-z]{6})?$/

/**
 * Validate a planet @p format
 */
export function isValidPlanetPatp(patp: string): boolean {
  return PATP_REGEX.test(patp)
}

/**
 * Check if a @p is a planet (not a star or galaxy)
 * Planets have two syllables separated by a hyphen
 */
export function isPlanet(patp: string): boolean {
  return patp.includes('-') && isValidPlanetPatp(patp)
}

/**
 * Check if a @p is a star
 * Stars have one syllable (4-6 chars after ~)
 */
export function isStar(patp: string): boolean {
  return /^~[a-z]{3,6}$/.test(patp)
}
