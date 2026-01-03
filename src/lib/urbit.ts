/**
 * Urbit Star/Planet Integration
 * Handles planet spawning and verification for the 256-user allocation
 */

export interface UrbitConfig {
  starPatp: string      // Your star's @p (e.g., ~sampel)
  bridgeUrl: string     // Bridge L2 roller URL
  maxPlanets: number    // Maximum planets to distribute (256)
}

export interface PlanetInfo {
  patp: string          // Planet's @p (e.g., ~sampel-palnet)
  point: number         // Azimuth point number
  sponsor: string       // Parent star's @p
  spawned: boolean
  claimed: boolean
  claimedAt?: Date
  userId?: string       // Associated user ID
}

export interface PlanetInvite {
  code: string          // Bridge invite code
  patp: string          // Planet @p to be claimed
  expiresAt: Date
  used: boolean
}

// Environment config
const getConfig = (): UrbitConfig => ({
  starPatp: import.meta.env.VITE_URBIT_STAR_PATP || '',
  bridgeUrl: import.meta.env.VITE_URBIT_BRIDGE_URL || 'https://bridge.urbit.org',
  maxPlanets: 256
})

/**
 * Urbit service for planet management
 */
export class UrbitService {
  private config: UrbitConfig
  private spawnedPlanets: Map<string, PlanetInfo> = new Map()

  constructor(config?: Partial<UrbitConfig>) {
    this.config = { ...getConfig(), ...config }
  }

  /**
   * Check if the star is configured and ready
   */
  isConfigured(): boolean {
    return !!this.config.starPatp && this.config.starPatp.startsWith('~')
  }

  /**
   * Get the star's @p
   */
  getStarPatp(): string {
    return this.config.starPatp
  }

  /**
   * Get count of available planets (256 - spawned)
   */
  async getAvailablePlanets(): Promise<number> {
    // In production, query Azimuth L2 roller for actual spawn count
    // For now, return based on local tracking
    return this.config.maxPlanets - this.spawnedPlanets.size
  }

  /**
   * Check if planets are still available
   */
  async hasPlanetsAvailable(): Promise<boolean> {
    const available = await this.getAvailablePlanets()
    return available > 0
  }

  /**
   * Generate a planet invite for a user
   * Uses Bridge L2 API to spawn planets without ETH gas fees
   */
  async generatePlanetInvite(userId: string): Promise<PlanetInvite> {
    if (!this.isConfigured()) {
      throw new Error('Urbit star not configured')
    }

    const available = await this.getAvailablePlanets()
    if (available <= 0) {
      throw new Error('No planets available - all 256 have been distributed')
    }

    // In production, this would call the Bridge L2 roller API
    // POST /v1/spawn with star credentials
    // Returns an invite code that user can claim at bridge.urbit.org

    // Placeholder for now - would integrate with Bridge API
    const inviteCode = generateInviteCode()
    const planetPatp = generateRandomPlanetPatp(this.config.starPatp)

    const invite: PlanetInvite = {
      code: inviteCode,
      patp: planetPatp,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      used: false
    }

    // Track the pending planet
    this.spawnedPlanets.set(planetPatp, {
      patp: planetPatp,
      point: 0, // Would be real point number from Azimuth
      sponsor: this.config.starPatp,
      spawned: true,
      claimed: false,
      userId
    })

    return invite
  }

  /**
   * Verify that a user owns a planet spawned by this star
   */
  async verifyPlanetOwnership(patp: string, ethereumAddress?: string): Promise<boolean> {
    // In production, query Azimuth contracts via ethers.js or Urbit's azimuth-js
    // Check if the planet is:
    // 1. Spawned by our star
    // 2. Owned by the given Ethereum address (if provided)

    const planet = this.spawnedPlanets.get(patp)
    if (!planet) {
      return false
    }

    // Check sponsor matches our star
    if (planet.sponsor !== this.config.starPatp) {
      return false
    }

    return planet.claimed
  }

  /**
   * Mark a planet as claimed (called after user completes Bridge flow)
   */
  async markPlanetClaimed(patp: string, userId: string): Promise<void> {
    const planet = this.spawnedPlanets.get(patp)
    if (planet) {
      planet.claimed = true
      planet.claimedAt = new Date()
      planet.userId = userId
      this.spawnedPlanets.set(patp, planet)
    }
  }

  /**
   * Get all planets for a user
   */
  getPlanetsForUser(userId: string): PlanetInfo[] {
    return Array.from(this.spawnedPlanets.values())
      .filter(p => p.userId === userId)
  }

  /**
   * Get distribution stats
   */
  getDistributionStats(): {
    total: number
    spawned: number
    claimed: number
    available: number
  } {
    const planets = Array.from(this.spawnedPlanets.values())
    return {
      total: this.config.maxPlanets,
      spawned: planets.length,
      claimed: planets.filter(p => p.claimed).length,
      available: this.config.maxPlanets - planets.length
    }
  }
}

// Helper functions

/**
 * Generate a random invite code
 */
function generateInviteCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let code = ''
  for (let i = 0; i < 16; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

/**
 * Generate a random planet @p under a star
 * In production, this would come from Azimuth
 */
function generateRandomPlanetPatp(starPatp: string): string {
  // Planet @p format: ~prefix-suffix (8 chars each)
  // This is a placeholder - real implementation uses Azimuth point numbers
  const syllables = [
    'zod', 'nec', 'bud', 'wes', 'sev', 'per', 'sut', 'let',
    'ful', 'pen', 'syt', 'dur', 'wep', 'ser', 'wyl', 'sun',
    'ryp', 'syx', 'dyr', 'nup', 'heb', 'peg', 'lup', 'dep',
    'dys', 'put', 'lug', 'hec', 'ryt', 'tyv', 'syd', 'nex'
  ]

  const pick = () => syllables[Math.floor(Math.random() * syllables.length)]
  return `~${pick()}${pick()}-${pick()}${pick()}`
}

// Singleton instance
let urbitService: UrbitService | null = null

export function getUrbitService(): UrbitService {
  if (!urbitService) {
    urbitService = new UrbitService()
  }
  return urbitService
}

export default UrbitService
