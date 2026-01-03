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
  // GRANULAR SCORING: Award points for PARTIAL prefix matches
  // This gives immediate feedback on mobile even when full prefix isn't reached
  
  // Find how many characters of the target prefix match
  let partialPrefixLength = 0
  for (let i = 0; i < Math.min(prefix.length, hash.length); i++) {
    if (hash[i] === prefix[i]) {
      partialPrefixLength = i + 1
    } else {
      break
    }
  }
  
  if (partialPrefixLength === 0) {
    return 0
  }
  
  // LEVEL-BASED POINTS: Award progressively higher points as prefix grows
  // Updated for better mobile granularity and reward scaling
  let levelPoints = 0
  switch (partialPrefixLength) {
    case 1: levelPoints = 1    // "2"
      break
    case 2: levelPoints = 2    // "21"
      break
    case 3: levelPoints = 5    // "21e" (Increased from 4 to make 5pt mobile target reachable)
      break
    case 4: levelPoints = 12   // "21e8" (Increased from 8)
      break
    case 5: levelPoints = 25   // "21e80" (Increased from 15)
      break
    case 6: levelPoints = 50   // "21e800"
      break
    case 7: levelPoints = 100  // "21e8000"
      break
    case 8: levelPoints = 250  // "21e80000"
      break
    default: levelPoints = Math.max(12, partialPrefixLength * 3)
  }
  
  // BONUS: Extra zeros after prefix = progressive multiplier
  let extraZeros = 0
  for (let i = partialPrefixLength; i < hash.length && extraZeros < 10; i++) {
    if (hash[i] === '0') {
      extraZeros++
    } else {
      break
    }
  }
  
  // Bonus multiplier: each extra zero = 1.5x (more gradual, prevents huge jumps)
  const bonusMultiplier = Math.pow(1.5, extraZeros)
  
  return Math.round(levelPoints * bonusMultiplier)
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

// Worker state
let mining = false
let challenge = ''
let mineStartTime = 0
let hashesInWindow = 0
let windowStartTime = 0
let currentHashRate = 0
let currentPrefix = '21e8'
let lastProgressPoints = 0

self.onmessage = (e: MessageEvent) => {
  const { type, data } = e.data

  switch (type) {
    case 'start':
      mining = true
      challenge = data.challenge
      currentPrefix = data.prefix || '21e8'
      lastProgressPoints = 0
      // Use shareDifficulty for streaming shares (default 15), targetPoints for stopping (optional)
      mine(data.targetPoints, data.shareDifficulty || 15, data.batchSize || 2000)
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

function mine(targetPoints: number | undefined, shareDifficulty: number, initialBatchSize: number) {
  let attempts = 0
  let bestHash = ''
  let bestNonce = ''
  let bestPoints = 0
  mineStartTime = Date.now()
  hashesInWindow = 0
  windowStartTime = Date.now()
  currentHashRate = 0
  let lastProgressTime = Date.now()
  let miningComplete = false
  
  // Dynamic batching state
  let currentBatchSize = initialBatchSize
  let firstReportSent = false

  const mineStep = () => {
    // If mining is stopped, just return (don't send complete unless we hit target)
    if (!mining) {
      console.log('[Worker] Mining stopped')
      return
    }

    // targetPoints is now optional - if null/undefined, we mine forever
    // If provided, we stop when we hit it
    const hasTarget = typeof targetPoints === 'number' && targetPoints > 0

    if (miningComplete && hasTarget) {
      // Target reached logic preserved for backward compatibility/dedicated mining
      mining = false
      
      const totalTime = Date.now() - mineStartTime
      const finalHashRate = totalTime > 0 ? Math.round((attempts * 1000) / totalTime) : 0
      
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

    let reachedTarget = false
    const batchStart = Date.now()

    for (let i = 0; i < currentBatchSize && !reachedTarget; i++) {
      const nonce = randomNonce()
      const input = challenge + nonce
      const hash = sha256Sync(input)
      const points = calculatePoints(hash, currentPrefix)

      attempts++
      hashesInWindow++

      // STREAMING LOGIC: If points meet share difficulty, emit immediately
      if (points >= shareDifficulty) {
        self.postMessage({
          type: 'share',
          data: {
            hash,
            nonce,
            points,
            trailingZeros: points > 0 ? countTrailingZeros(hash, currentPrefix) : 0,
            attempts // attempts since start
          }
        })
      }

      if (points > bestPoints) {
        bestPoints = points
        bestHash = hash
        bestNonce = nonce

        if (points > lastProgressPoints) {
          lastProgressPoints = points
        }

        // Check if we've reached TARGET (for dedicated mining)
        if (hasTarget && targetPoints && points >= targetPoints) {
          console.log('[Worker] ✓ Target reached! ' + points + '/' + targetPoints + ' points')
          miningComplete = true
          reachedTarget = true
          break
        }
      }
    }

    // Dynamic batch sizing: target 16ms per batch (60fps)
    const batchDuration = Date.now() - batchStart
    if (batchDuration > 0) {
      // Adjust based on performance (damped update)
      const targetBatchSize = Math.floor(currentBatchSize * (16 / batchDuration))
      // Clamp to reasonable limits (100 - 20000) to prevent freezing or overhead
      currentBatchSize = Math.max(100, Math.min(20000, Math.floor((currentBatchSize + targetBatchSize) / 2)))
    }

    if (miningComplete && hasTarget) {
      setTimeout(mineStep, 0)
      return
    }

    // Continue mining - update progress
    const now = Date.now()
    const windowElapsed = now - windowStartTime
    
    // Update hash rate every 300ms
    if (windowElapsed >= 300) { 
      currentHashRate = Math.round((hashesInWindow * 1000) / windowElapsed)
      hashesInWindow = 0
      windowStartTime = now
    }

    // Report progress every 200ms OR immediately if it's the first batch (for UX responsiveness)
    if (now - lastProgressTime >= 200 || !firstReportSent) {
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
      firstReportSent = true
    }

    setTimeout(mineStep, 0)
  }

  console.log('[Worker] Starting mining. Target:', targetPoints || 'Infinite', 'ShareDifficulty:', shareDifficulty)
  mineStep()
}
