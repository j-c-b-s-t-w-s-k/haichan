/**
 * Generate a 4chan-style tripcode from a password
 * Format: Username#password -> Username !tripcode
 * Secure tripcodes use ##password -> Username !!tripcode
 */

export function parseTripcode(input: string): { username: string; password: string | null; isSecure: boolean } {
  if (!input) {
    return {
      username: '',
      password: null,
      isSecure: false
    }
  }

  // Check for secure tripcode (##) - must be checked first since it contains #
  const secureMatch = input.match(/^(.*?)##(.+)$/)
  if (secureMatch) {
    return {
      username: secureMatch[1].trim(),
      password: secureMatch[2],
      isSecure: true
    }
  }
  
  // Check for regular tripcode (#)
  const regularMatch = input.match(/^(.*?)#(.+)$/)
  if (regularMatch) {
    return {
      username: regularMatch[1].trim(),
      password: regularMatch[2],
      isSecure: false
    }
  }
  
  // No tripcode
  return {
    username: input.trim(),
    password: null,
    isSecure: false
  }
}

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Encode hash as base64-like string using 4chan's character set
 * This creates a consistent, visually distinctive tripcode
 */
function encodeTripcodeHash(hash: string, length: number): string {
  // 4chan uses a specific character set for tripcodes
  const charset = '.ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  
  // Convert hash bytes to base64-like tripcode
  for (let i = 0; i < length && i < hash.length; i += 2) {
    const byte = parseInt(hash.substr(i, 2), 16)
    result += charset[byte % charset.length]
  }
  
  return result
}

export async function generateTripcode(password: string, isSecure: boolean = false): Promise<string> {
  if (!password || password.trim() === '') return ''
  
  try {
    const hash = await sha256(password.trim())
    
    if (isSecure) {
      // Secure tripcode: Longer hash with !! prefix
      const encoded = encodeTripcodeHash(hash, 12)
      return '!!' + encoded
    } else {
      // Regular tripcode: Shorter hash with ! prefix
      const encoded = encodeTripcodeHash(hash, 8)
      return '!' + encoded
    }
  } catch (error) {
    console.error('Error generating tripcode:', error)
    return ''
  }
}

export function formatNameWithTripcode(username: string, tripcode: string | null): string {
  if (!tripcode || tripcode === '') return username || 'Anonymous'
  return `${username || 'Anonymous'} ${tripcode}`
}
