declare module '@blinkdotnew/sdk' {
  // Minimal shims for build-time only. Use the real SDK at runtime.
  export function createClient(config: any): any
  export type RealtimeChannel = any
  export type BlinkDatabase = any
  export const db: any
}

declare module 'bitcoinjs-lib'
declare module 'tiny-secp256k1'
declare module 'ecpair'
declare module 'vitest'
declare module 'elliptic'
