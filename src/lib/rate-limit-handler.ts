/**
 * Rate limit handler with exponential backoff and request throttling
 * Handles 429 errors from Blink SDK gracefully
 */

interface QueuedRequest {
  id: string
  fn: () => Promise<any>
  resolve: (value: any) => void
  reject: (reason?: any) => void
  retries: number
}

class RateLimitHandler {
  private queue: QueuedRequest[] = []
  private processing = false
  private requestsInFlight = 0
  private maxConcurrent = 5
  private lastResetTime = Date.now()
  private requestsThisWindow = 0
  private readonly RATE_LIMIT_WINDOW = 1000 // 1 second
  private readonly MAX_REQUESTS_PER_WINDOW = 100
  private readonly MAX_RETRIES = 3
  private readonly INITIAL_BACKOFF = 500 // 500ms

  /**
   * Execute a function with automatic rate limiting and retry logic
   */
  async execute<T>(fn: () => Promise<T>, requestId?: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = requestId || `req-${Date.now()}-${Math.random()}`
      
      this.queue.push({
        id,
        fn,
        resolve,
        reject,
        retries: 0
      })

      this.processQueue()
    })
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return
    }

    this.processing = true

    while (this.queue.length > 0 && this.requestsInFlight < this.maxConcurrent) {
      // Check rate limit window
      const now = Date.now()
      if (now - this.lastResetTime > this.RATE_LIMIT_WINDOW) {
        this.lastResetTime = now
        this.requestsThisWindow = 0
      }

      // If we're hitting the rate limit, wait
      if (this.requestsThisWindow >= this.MAX_REQUESTS_PER_WINDOW) {
        const waitTime = this.RATE_LIMIT_WINDOW - (now - this.lastResetTime)
        await this.sleep(Math.min(waitTime, 100))
        continue
      }

      const request = this.queue.shift()
      if (!request) break

      this.requestsInFlight++
      this.requestsThisWindow++

      this.executeWithRetry(request)
        .then(result => {
          request.resolve(result)
        })
        .catch(error => {
          request.reject(error)
        })
        .finally(() => {
          this.requestsInFlight--
          // Continue processing queue
          setImmediate(() => this.processQueue())
        })
    }

    this.processing = false
  }

  private async executeWithRetry(request: QueuedRequest): Promise<any> {
    try {
      return await request.fn()
    } catch (error: any) {
      // Handle rate limit errors with exponential backoff
      if (error?.status === 429 || error?.code === 'NETWORK_ERROR') {
        if (request.retries < this.MAX_RETRIES) {
          const backoffTime = this.INITIAL_BACKOFF * Math.pow(2, request.retries)
          request.retries++
          
          console.warn(
            `Rate limit hit (attempt ${request.retries}/${this.MAX_RETRIES}), ` +
            `retrying in ${backoffTime}ms...`
          )
          
          await this.sleep(backoffTime)
          
          // Re-queue the request at the front
          this.queue.unshift(request)
          
          // Process queue again
          setImmediate(() => this.processQueue())
          
          // Return a promise that will be resolved when retried
          return new Promise((resolve, reject) => {
            const originalResolve = request.resolve
            const originalReject = request.reject
            request.resolve = resolve
            request.reject = reject
            // Note: originalResolve and originalReject will be called by processQueue
          })
        }
      }
      
      throw error
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get current queue status (for debugging)
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      requestsInFlight: this.requestsInFlight,
      requestsThisWindow: this.requestsThisWindow,
      maxConcurrent: this.maxConcurrent
    }
  }
}

export const rateLimitHandler = new RateLimitHandler()
