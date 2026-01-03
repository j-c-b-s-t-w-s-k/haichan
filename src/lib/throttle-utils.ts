/**
 * Throttle function to limit how often a function can be called
 * Essential for preventing rate limit errors from repeated polling
 */

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null
  let previous = 0

  return function executedFunction(...args: Parameters<T>) {
    const now = Date.now()
    const remaining = wait - (now - previous)

    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      previous = now
      func.apply(null, args)
    } else if (!timeout) {
      timeout = setTimeout(() => {
        previous = Date.now()
        timeout = null
        func.apply(null, args)
      }, remaining)
    }
  }
}

/**
 * Debounce function to delay execution until after a wait period
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func.apply(null, args)
    }

    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(later, wait)
  }
}

/**
 * Rate limit helper for async operations with backoff
 */
export class RateLimiter {
  private lastRequestTime = 0
  private minInterval: number

  constructor(requestsPerSecond: number = 5) {
    this.minInterval = 1000 / requestsPerSecond
  }

  async acquire(): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime

    if (timeSinceLastRequest < this.minInterval) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.minInterval - timeSinceLastRequest)
      )
    }

    this.lastRequestTime = Date.now()
  }

  reset(): void {
    this.lastRequestTime = 0
  }
}
