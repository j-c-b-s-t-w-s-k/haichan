import { MiningManager } from './mining/MiningManager'

export interface PoWValidationData {
  challenge: string
  nonce: string
  hash: string
  prefix: string
  points: number
  trailingZeros: number
}

/**
 * Get PoW validation data from the mining manager
 * This will be sent to the server for validation when creating posts/threads
 */
export function getPoWValidationData(): PoWValidationData | null {
  const manager = MiningManager.getInstance()
  const powResult = manager.getLastPoWResult()
  
  if (!powResult) {
    console.warn('No PoW result found. Mining may not have completed.')
    return null
  }

  const { result, challenge, prefix } = powResult

  return {
    challenge,
    nonce: result.nonce,
    hash: result.hash,
    prefix,
    points: result.points,
    trailingZeros: result.trailingZeros
  }
}

/**
 * Check if valid PoW is currently available
 * Valid PoW must have hash starting with required prefix OR any valid prefix with sufficient points
 * Minimum requirement: Defaults to 21e8 prefix (15 points) for standard posting
 * Can accept higher prefixes (21e80, 21e800, etc.) for bonus points or harder threads
 */
export function isValidPoWAvailable(minPrefix: string = '21e8', minPoints: number = 15): boolean {
  const powData = getPoWValidationData()
  if (!powData) return false
  
  // Must have at least the required prefix
  if (!powData.hash.startsWith(minPrefix)) return false
  
  // Must have at least the required points
  return powData.points >= minPoints
}

/**
 * Clear the stored PoW validation data after use
 */
export function clearPoWValidationData(): void {
  const manager = MiningManager.getInstance()
  manager.clearLastPoWResult()
}

/**
 * Fetch post number with optional PoW validation
 */
export async function fetchPostNumberWithPoW(includePoW: boolean = true): Promise<number> {
  const endpoint = 'https://7e3gh26u--increment-post-number.functions.blink.new'
  
  const requestBody: { powData?: PoWValidationData } = {}
  
  if (includePoW) {
    const powData = getPoWValidationData()
    if (powData) {
      // Validate PoW data meets minimum requirements before sending
      // Minimum: 21e8 prefix with 15 points
      // Bonus: Trailing zeros increase points exponentially (4x per zero)
      const meetsPrefix = powData.hash.startsWith('21e8')
      const meetsPoints = powData.points >= 15
      const meetsRequirements = meetsPrefix && meetsPoints
      
      if (meetsRequirements) {
        requestBody.powData = powData
        const pointsBonus = powData.points > 15 ? ` (+${powData.points - 15} bonus points)` : ''
        console.log(`✓ Including valid PoW validation data${pointsBonus}:`, {
          hash: powData.hash.substring(0, 20) + '...',
          prefix: powData.prefix,
          points: powData.points,
          trailingZeros: powData.trailingZeros
        })
      } else {
        console.warn('⚠ PoW data does not meet minimum requirements (21e8, 15+ points), skipping PoW validation:', {
          hash: powData.hash.substring(0, 20) + '...',
          prefix: powData.prefix,
          points: powData.points,
          meetsPrefix: meetsPrefix,
          meetsPoints: meetsPoints,
          trailingZeros: powData.trailingZeros
        })
        // Don't include invalid PoW - let the server proceed without PoW validation
      }
    } else {
      console.warn('PoW validation requested but no PoW data available - proceeding without PoW')
    }
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    let errorMessage = `Failed to get post number (${response.status})`
    try {
      const errorData = await response.json()
      if (errorData.error) {
        errorMessage = errorData.error
      }
    } catch {
      // If JSON parsing fails, try text
      const errorText = await response.text()
      if (errorText) {
        errorMessage = errorText
      }
    }
    console.error('❌ Edge function error:', errorMessage)
    throw new Error(errorMessage)
  }

  const result = await response.json()
  const postNumber = result.postNumber

  // Validate post number
  if (!Number.isFinite(postNumber) || postNumber <= 0) {
    console.error('❌ Invalid post number received:', postNumber)
    throw new Error(`Invalid post number received: ${postNumber}`)
  }

  console.log('✓ Valid post number received:', postNumber)

  // Clear PoW data after successful use
  if (includePoW) {
    clearPoWValidationData()
  }

  return postNumber
}
