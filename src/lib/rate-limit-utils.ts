/**
 * Rate Limit Utility Module
 * 
 * Implements exponential backoff, request queuing, and retry logic
 * for handling rate-limited database endpoints.
 */

type RateLimitErrorChecker = (error: any) => boolean

interface RateLimitConfig {
  maxRetries?: number
  initialDelayMs?: number
  maxDelayMs?: number
  backoffMultiplier?: number
  timeoutMs?: number
}

interface QueuedRequest<T> {
  fn: () => Promise<T>
  resolve: (value: T) => void
  reject: (reason?: any) => void
  retries: number
}

class RateLimitManager {
  private requestQueue: QueuedRequest<any>[] = []
  private isProcessing = false
  private lastRequestTime = 0
  private minDelayBetweenRequests = 100 // ms

  private config: Required<RateLimitConfig> = {
    maxRetries: 5,
    initialDelayMs: 100,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    timeoutMs: 30000
  }

  constructor(config?: RateLimitConfig) {
    this.config = { ...this.config, ...config }
  }

  /**
   * Check if error is a rate limit error
   */
  private isRateLimitError(error: any): boolean {
    if (!error) return false

    const message = error?.message?.toLowerCase() || ''
    const details = error?.details?.toString().toLowerCase() || ''
    const status = error?.status

    // Check for common rate limit indicators
    return (
      status === 429 ||
      status === 503 ||
      message.includes('rate limit') ||
      message.includes('too many requests') ||
      message.includes('quota') ||
      message.includes('throttle') ||
      details.includes('rate limit') ||
      details.includes('too many') ||
      error?.code === 'RATE_LIMITED' ||
      error?.code === 'QUOTA_EXCEEDED'
    )
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(retryCount: number): number {
    const delay = this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, retryCount)
    const jitter = Math.random() * 0.1 * delay // Add 10% jitter to prevent thundering herd
    return Math.min(delay + jitter, this.config.maxDelayMs)
  }

  /**
   * Wait for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Respect minimum delay between requests to avoid hammering API
   */
  private async enforceMinDelay(): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    if (timeSinceLastRequest < this.minDelayBetweenRequests) {
      await this.delay(this.minDelayBetweenRequests - timeSinceLastRequest)
    }
    this.lastRequestTime = Date.now()
  }

  /**
   * Execute a single request with retry logic
   */
  private async executeWithRetry<T>(fn: () => Promise<T>, retryCount = 0): Promise<T> {
    try {
      await this.enforceMinDelay()
      return await Promise.race([
        fn(),
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), this.config.timeoutMs)
        )
      ])
    } catch (error) {
      if (this.isRateLimitError(error) && retryCount < this.config.maxRetries) {
        const delay = this.calculateBackoffDelay(retryCount)
        console.warn(
          `Rate limited (attempt ${retryCount + 1}/${this.config.maxRetries}). ` +
          `Retrying in ${delay.toFixed(0)}ms...`,
          error
        )
        await this.delay(delay)
        return this.executeWithRetry(fn, retryCount + 1)
      }
      throw error
    }
  }

  /**
   * Process queued requests one at a time
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return
    }

    this.isProcessing = true

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift()
      if (!request) break

      try {
        const result = await this.executeWithRetry(request.fn, request.retries)
        request.resolve(result)
      } catch (error) {
        request.reject(error)
      }
    }

    this.isProcessing = false
  }

  /**
   * Queue a request for execution
   * Ensures sequential execution to avoid rate limits
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        fn,
        resolve,
        reject,
        retries: 0
      })
      this.processQueue().catch(console.error)
    })
  }

  /**
   * Get current queue length
   */
  getQueueLength(): number {
    return this.requestQueue.length
  }

  /**
   * Clear queue (useful for cleanup)
   */
  clearQueue(): void {
    this.requestQueue.forEach(req => {
      req.reject(new Error('Queue cleared'))
    })
    this.requestQueue = []
  }
}

// Create default manager instance
const defaultManager = new RateLimitManager()

/**
 * Execute a function with automatic rate limit handling
 * 
 * @param fn - The async function to execute
 * @param config - Optional configuration overrides
 * @returns Promise with result or error
 * 
 * @example
 * const result = await withRateLimit(async () => {
 *   return await db.db.imageMetadata.list()
 * })
 */
export async function withRateLimit<T>(
  fn: () => Promise<T>,
  config?: RateLimitConfig
): Promise<T> {
  if (config) {
    const manager = new RateLimitManager(config)
    return manager.execute(fn)
  }
  return defaultManager.execute(fn)
}

/**
 * Execute multiple requests in parallel with rate limit handling
 * Batches requests to avoid overwhelming the API
 * 
 * @param fns - Array of async functions to execute
 * @param batchSize - Number of requests to execute in parallel (default: 3)
 * @returns Promise array of results
 * 
 * @example
 * const results = await batchWithRateLimit([
 *   () => db.db.users.list(),
 *   () => db.db.posts.list(),
 *   () => db.db.threads.list()
 * ], 2)
 */
export async function batchWithRateLimit<T>(
  fns: Array<() => Promise<T>>,
  batchSize = 3,
  config?: RateLimitConfig
): Promise<T[]> {
  const results: T[] = []

  for (let i = 0; i < fns.length; i += batchSize) {
    const batch = fns.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(fn => withRateLimit(fn, config))
    )
    results.push(...batchResults)
  }

  return results
}

/**
 * Retry a function with exponential backoff
 * 
 * @param fn - The async function to execute
 * @param config - Optional configuration
 * @returns Promise with result or error after all retries exhausted
 * 
 * @example
 * const result = await retryWithBackoff(async () => {
 *   return await riskyOperation()
 * }, { maxRetries: 3 })
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config?: RateLimitConfig
): Promise<T> {
  const manager = new RateLimitManager(config)
  return manager.execute(fn)
}

/**
 * Create a rate-limited wrapper for a function
 * Returns a function that will apply rate limiting to all calls
 * 
 * @param fn - The async function to wrap
 * @param config - Optional configuration
 * @returns Wrapped function with rate limiting
 * 
 * @example
 * const limitedListImages = rateLimitWrapper(
 *   () => db.db.imageMetadata.list()
 * )
 * const result = await limitedListImages()
 */
export function rateLimitWrapper<T>(
  fn: () => Promise<T>,
  config?: RateLimitConfig
): () => Promise<T> {
  return () => withRateLimit(fn, config)
}

/**
 * Get statistics about the rate limiter
 */
export function getRateLimitStats() {
  return {
    queueLength: defaultManager.getQueueLength(),
    timestamp: new Date().toISOString()
  }
}

/**
 * Clear the default rate limit queue
 * Useful for cleanup or testing
 */
export function clearRateLimitQueue(): void {
  defaultManager.clearQueue()
}

export default withRateLimit
