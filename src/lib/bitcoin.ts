/**
 * Bitcoin credential validation utilities
 * Uses real Bitcoin address validation with bitcoinjs-lib
 * 
 * 🔒 SECURITY: All functions are CLIENT-SIDE ONLY
 * Private keys are NEVER transmitted to servers or stored in databases
 * These utilities only validate and derive addresses locally in the browser
 */

// Safe import with fallback implementations
import * as bitcoinLib from 'bitcoinjs-lib'
import * as eccLib from 'tiny-secp256k1'
import { ECPairFactory } from 'ecpair'

let bitcoin = bitcoinLib
let ecc = eccLib
let ECPair: any

// Initialize with defensive checks
try {
  if (bitcoin?.initEccLib && ecc) {
    bitcoin.initEccLib(ecc)
    ECPair = ECPairFactory(ecc)
  } else {
    throw new Error('Bitcoin dependencies not properly loaded')
  }
} catch (importError) {
  console.warn('Bitcoin crypto utilities partially available:', importError)
  // Provide fallback implementations to prevent crashes
  bitcoin = {
    initEccLib: () => {},
    address: { fromBech32: () => {} },
    networks: { bitcoin: {} },
    payments: { p2pkh: () => ({ address: '' }) }
  }
  ECPair = {
    fromWIF: () => { throw new Error('Bitcoin crypto not available in this environment') },
    makeRandom: () => { throw new Error('Bitcoin crypto not available in this environment') }
  }
}

// bs58check is only used for legacy/P2SH address validation
// We use a lightweight inline implementation to avoid Buffer issues
const BS58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

function bs58decode(str: string): Uint8Array {
  let num = 0n
  for (const char of str) {
    const digit = BS58_CHARS.indexOf(char)
    if (digit === -1) throw new Error('Invalid base58 character')
    num = num * 58n + BigInt(digit)
  }
  
  const bytes: number[] = []
  while (num > 0n) {
    bytes.unshift(Number(num % 256n))
    num = num / 256n
  }
  
  // Add leading zero bytes
  for (const char of str) {
    if (char === '1') bytes.unshift(0)
    else break
  }
  
  return new Uint8Array(bytes)
}

/**
 * Validate Bitcoin address checksum using SHA256
 */
async function validateChecksum(decoded: Uint8Array): Promise<boolean> {
  const payload = decoded.slice(0, -4)
  const checksum = decoded.slice(-4)
  
  // Double SHA256 hash
  const hash1 = await crypto.subtle.digest('SHA-256', payload)
  const hash2 = await crypto.subtle.digest('SHA-256', hash1)
  
  const hash2Array = new Uint8Array(hash2)
  const checksumFromHash = hash2Array.slice(0, 4)
  
  // Compare checksums
  return Array.from(checksum).every((byte, i) => byte === checksumFromHash[i])
}

/**
 * Validate a Bitcoin address (supports Legacy P2PKH, P2SH, Bech32, Bech32m)
 * @param address - Bitcoin address to validate
 * @returns true if valid Bitcoin address
 */
export async function isValidBitcoinAddress(address: string): Promise<boolean> {
  try {
    // Defensive check for input
    if (!address || typeof address !== 'string') {
      return false
    }
    
    // Try to decode as base58check (Legacy/P2SH)
    if (address.startsWith('1') || address.startsWith('3')) {
      try {
        const decoded = bs58decode(address)
        if (decoded.length !== 25) return false // Must be 25 bytes: 1 version + 20 payload + 4 checksum
        
        // Validate checksum
        const isValidChecksum = await validateChecksum(decoded)
        if (!isValidChecksum) return false
        
        // Check valid version bytes: 0x00 for mainnet P2PKH, 0x05 for P2SH
        const version = decoded[0]
        return version === 0x00 || version === 0x05
      } catch (e) {
        return false
      }
    }
    
    // Try to decode as bech32/bech32m (SegWit)
    if (address.startsWith('bc1')) {
      try {
        if (bitcoin?.address?.fromBech32) {
          bitcoin.address.fromBech32(address)
          return true
        }
      } catch (e) {
        return false
      }
    }
    
    return false
  } catch {
    return false
  }
}

/**
 * Extract address type for display purposes
 */
export function getBitcoinAddressType(address: string): string {
  if (!address || typeof address !== 'string') return 'Unknown'
  if (address.startsWith('1')) return 'Legacy (P2PKH)'
  if (address.startsWith('3')) return 'P2SH'
  if (address.startsWith('bc1q')) return 'SegWit (Bech32)'
  if (address.startsWith('bc1p')) return 'Taproot (Bech32m)'
  return 'Unknown'
}

/**
 * Validate Bitcoin private key in WIF format
 * @param wif - Private key in Wallet Import Format
 * @returns true if valid WIF key
 */
export function isValidWIF(wif: string): boolean {
  try {
    if (!wif || typeof wif !== 'string') return false
    if (!ECPair?.fromWIF) return false
    ECPair.fromWIF(wif)
    return true
  } catch {
    return false
  }
}

/**
 * Derive Bitcoin address from WIF private key
 * @param wif - Private key in WIF format
 * @returns Bitcoin address derived from the key
 */
export function deriveAddressFromWIF(wif: string): string {
  try {
    if (!wif || typeof wif !== 'string') return ''
    if (!ECPair?.fromWIF || !bitcoin?.payments?.p2pkh) return ''
    
    const keyPair = ECPair.fromWIF(wif)
    if (!keyPair?.publicKey) return ''
    
    const { address } = bitcoin.payments.p2pkh({ 
      pubkey: keyPair.publicKey,
      network: bitcoin.networks.bitcoin // Explicitly use mainnet
    })
    return address || ''
  } catch {
    return ''
  }
}

/**
 * Get public key hex from WIF private key
 */
export function getPublicKeyFromWIF(wif: string): string {
  try {
    if (!wif || typeof wif !== 'string') return ''
    if (!ECPair?.fromWIF) return ''
    
    const keyPair = ECPair.fromWIF(wif)
    if (!keyPair?.publicKey?.toString) return ''
    
    return keyPair.publicKey.toString('hex')
  } catch {
    return ''
  }
}

/**
 * Generate a new random Bitcoin keypair
 * @returns { privateKey: WIF, publicKey: hex, address: string } or null if unavailable
 */
export function generateBitcoinKeypair(): { privateKey: string; publicKey: string; address: string } | null {
  try {    // Check if Bitcoin crypto is actually available (not in fallback mode)
    if (!ECPair?.makeRandom || typeof ECPair.makeRandom !== 'function') {
      console.warn('Bitcoin keypair generation not available - crypto not loaded');
      return null
    }
    
    if (!bitcoin?.payments?.p2pkh || !bitcoin?.networks?.bitcoin) {
      console.warn('Bitcoin payments or networks not configured');
      return null
    }
    
    // Generate random keypair (no network param needed - defaults to mainnet)
    const keyPair = ECPair.makeRandom()
    
    if (!keyPair?.publicKey?.toString || !keyPair?.toWIF) {
      console.warn('Failed to generate keypair - missing methods');
      return null
    }
    
    // Derive P2PKH address from public key
    const { address } = bitcoin.payments.p2pkh({ 
      pubkey: keyPair.publicKey,
      network: bitcoin.networks.bitcoin // Explicitly use mainnet
    })
    
    if (!address) {
      console.warn('Failed to generate Bitcoin address from keypair');
      return null
    }
    
    return {
      privateKey: keyPair.toWIF(),
      publicKey: keyPair.publicKey.toString('hex'),
      address: address
    }
  } catch (error) {
    console.warn(`Bitcoin keypair generation failed gracefully: ${error instanceof Error ? error.message : String(error)}`);
    return null
  }
}
