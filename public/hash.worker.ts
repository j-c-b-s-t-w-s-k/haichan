// SHA-256 implementation for Web Worker
function sha256Sync(str: string): string {
  const encoder = new TextEncoder()
  const data = encoder.encode(str)

  function rightRotate(value: number, amount: number): number {
    return (value >>> amount) | (value << (32 - amount))
  }

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a,
    h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19

  const ml = data.length * 8
  const paddedLength = Math.ceil((data.length + 9) / 64) * 64
  const padded = new Uint8Array(paddedLength)
  padded.set(data)
  padded[data.length] = 0x80

  const view = new DataView(padded.buffer)
  view.setUint32(paddedLength - 4, ml, false)

  for (let chunk = 0; chunk < paddedLength; chunk += 64) {
    const w = new Uint32Array(64)
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(chunk + i * 4, false)
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3)
      const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7

    for (let i = 0; i < 64; i++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)
      const ch = (e & f) ^ (~e & g)
      const temp1 = (h + S1 + ch + k[i] + w[i]) | 0
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (S0 + maj) | 0

      h = g; g = f; f = e; e = (d + temp1) | 0
      d = c; c = b; b = a; a = (temp1 + temp2) | 0
    }

    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map(v => (v >>> 0).toString(16).padStart(8, '0'))
    .join('')
}

function randomNonce(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')
}

function calculatePoints(hash: string, prefix: string): number {
  if (!hash.startsWith(prefix)) {
    return 0
  }
  
  // Count trailing zeros after the prefix for granular PoW scoring
  let extraZeros = 0
  for (let i = prefix.length; i < hash.length && extraZeros < 10; i++) {
    if (hash[i] === '0') {
      extraZeros++
    } else {
      break
    }
  }
  
  // Base points by prefix difficulty level (granular scaling)
  let basePoints = 0
  if (prefix === '21') basePoints = 4           // Easiest
  else if (prefix === '21e') basePoints = 8     // Easy
  else if (prefix === '21e8') basePoints = 15   // Standard (default)
  else if (prefix === '21e80') basePoints = 60  // Hard
  else if (prefix === '21e800') basePoints = 240
  else if (prefix === '21e8000') basePoints = 960
  else if (prefix === '21e80000') basePoints = 3840 // Legendary
  else basePoints = 15 // Default to standard level
  
  // Exponential bonus for trailing zeros (4x per zero for diamond scaling)
  return basePoints * Math.pow(4, extraZeros)
}

function countTrailingZeros(hash: string, prefix: string): number {
  if (!hash.startsWith(prefix)) {
    return 0
  }
  
  let count = 0
  for (let i = prefix.length; i < hash.length && count < 10; i++) {
    if (hash[i] === '0') {
      count++
    } else {
      break
    }
  }
  
  return count
}

// Worker message handler and hash rate tracking
let mining = false
let challenge = ''
let mineStartTime = 0
let hashesInWindow = 0
let windowStartTime = 0
let currentHashRate = 0
let currentPrefix = '21e8'

self.onmessage = (e: MessageEvent) => {
  const { type, data } = e.data

  switch (type) {
    case 'start':
      mining = true
      challenge = data.challenge
      currentPrefix = data.prefix || '21e8'
      mine(data.targetPoints || 15)
      break
    
    case 'stop':
      mining = false
      break
    
    case 'hash':
      const hash = sha256Sync(data.input)
      self.postMessage({ type: 'hash_result', hash })
      break
  }
}

function mine(targetPoints: number) {
  let attempts = 0
  let bestHash = ''
  let bestNonce = ''
  let bestPoints = 0
  mineStartTime = Date.now()
  hashesInWindow = 0
  windowStartTime = Date.now()
  currentHashRate = 0
  let lastProgressTime = Date.now()

  const mineStep = () => {
    // Check if mining was stopped
    if (!mining) {
      const totalTime = Date.now() - mineStartTime
      const finalHashRate = totalTime > 0 ? Math.round((attempts * 1000) / totalTime) : 0
      
      console.log('[Worker] Mining stopped - sending completion', {
        hash: bestHash.substring(0, 16) + '...',
        points: bestPoints,
        attempts
      })
      
      self.postMessage({
        type: 'complete',
        data: {
          hash: bestHash,
          nonce: bestNonce,
          points: bestPoints,
          trailingZeros: bestPoints > 0 ? countTrailingZeros(bestHash, currentPrefix) : 0,
          attempts,
          hashRate: finalHashRate
        }
      })
      return
    }

    // Process hashes in batches
    let batchComplete = false
    for (let i = 0; i < 5000 && !batchComplete; i++) {
      const nonce = randomNonce()
      const input = challenge + nonce
      const hash = sha256Sync(input)
      const points = calculatePoints(hash, currentPrefix)
      const trailingZeros = countTrailingZeros(hash, currentPrefix)

      attempts++
      hashesInWindow++

      // Update best result if this hash is better
      if (points > bestPoints) {
        bestPoints = points
        bestHash = hash
        bestNonce = nonce

        console.log(`[Worker] New best: ${points} points (${attempts} attempts)`, hash.substring(0, 16) + '...')

        // Check if we've reached the target
        if (points >= targetPoints) {
          console.log('[Worker] Target reached! Stopping mining...', {
            points,
            targetPoints,
            hash: hash.substring(0, 16) + '...'
          })
          mining = false
          batchComplete = true
          break
        }
      }
    }

    // If we hit the target, don't schedule another iteration
    if (!mining) {
      mineStep() // Send final completion message
      return
    }

    // Update rolling hash rate every 500ms
    const now = Date.now()
    const windowElapsed = now - windowStartTime
    if (windowElapsed >= 500) {
      currentHashRate = Math.round((hashesInWindow * 1000) / windowElapsed)
      hashesInWindow = 0
      windowStartTime = now
    }

    // Send progress update periodically (every 200ms) with granular info
    if (now - lastProgressTime >= 200) {
      self.postMessage({
        type: 'progress',
        data: {
          hash: bestHash,
          nonce: bestNonce,
          points: bestPoints,
          trailingZeros: bestPoints > 0 ? countTrailingZeros(bestHash, currentPrefix) : 0,
          attempts,
          hashRate: currentHashRate
        }
      })
      lastProgressTime = now
    }

    // Schedule next batch with immediate callback
    setTimeout(mineStep, 0)
  }

  // Start mining immediately
  console.log('[Worker] Starting mining with targetPoints:', targetPoints, 'prefix:', currentPrefix)
  mineStep()
}
