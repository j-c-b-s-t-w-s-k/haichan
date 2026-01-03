/**
 * Crypto utilities for hashing and encoding
 */

/**
 * SHA-256 hash function
 */
export async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate random hex string
 */
export function randomHex(length: number): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate a cryptographically secure salt
 */
export function generateSalt(): string {
  return randomHex(32) // 64 character hex string
}

/**
 * Create salted hash of a private key for backup authentication
 * Uses PBKDF2 with 100,000 iterations for security
 */
export async function hashPrivateKey(privateKey: string, salt: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(privateKey),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )
  
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256 // 256 bits = 32 bytes
  )
  
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Verify a private key against a stored salted hash
 */
export async function verifyPrivateKey(privateKey: string, salt: string, storedHash: string): Promise<boolean> {
  const computedHash = await hashPrivateKey(privateKey, salt)
  return computedHash === storedHash
}
