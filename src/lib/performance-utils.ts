/**
 * Performance optimization utilities for Haichan
 * Implements batching, debouncing, and caching strategies
 */

/**
 * Debounce function calls to reduce excessive updates
 * @param fn Function to debounce
 * @param delay Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return function debounced(...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      fn(...args)
      timeoutId = null
    }, delay)
  }
}

/**
 * Throttle function calls - execute at most once per interval
 * @param fn Function to throttle
 * @param interval Interval in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  interval: number
): (...args: Parameters<T>) => void {
  let lastTime = 0

  return function throttled(...args: Parameters<T>) {
    const now = Date.now()

    if (now - lastTime >= interval) {
      fn(...args)
      lastTime = now
    }
  }
}

/**
 * Simple LRU cache with TTL support
 */
export class TTLCache<K, V> {
  private cache: Map<K, { value: V; expireAt: number }> = new Map()
  private ttl: number

  constructor(ttlMs: number = 60000) {
    this.ttl = ttlMs
  }

  set(key: K, value: V): void {
    this.cache.set(key, {
      value,
      expireAt: Date.now() + this.ttl
    })
  }

  get(key: K): V | null {
    const item = this.cache.get(key)

    if (!item) return null

    if (Date.now() > item.expireAt) {
      this.cache.delete(key)
      return null
    }

    return item.value
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }
}

/**
 * Batch database operations to reduce request overhead
 */
export class OperationBatcher {
  private queue: Array<() => Promise<any>> = []
  private timer: ReturnType<typeof setTimeout> | null = null
  private maxBatchSize: number = 10
  private batchDelayMs: number = 50

  constructor(maxBatchSize: number = 10, batchDelayMs: number = 50) {
    this.maxBatchSize = maxBatchSize
    this.batchDelayMs = batchDelayMs
  }

  async add(operation: () => Promise<any>): Promise<void> {
    this.queue.push(operation)

    // Execute immediately if batch is full
    if (this.queue.length >= this.maxBatchSize) {
      await this.flush()
    } else if (!this.timer) {
      // Schedule flush
      this.timer = setTimeout(() => this.flush(), this.batchDelayMs)
    }
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }

    if (this.queue.length === 0) return

    const batch = this.queue.splice(0, this.queue.length)
    await Promise.all(batch.map(op => op().catch(e => console.error('Batch operation failed:', e))))
  }
}

/**
 * Request coalescing - combine multiple identical requests into one
 */
export class RequestCoalescer<K, V> {
  private pending: Map<K, Promise<V>> = new Map()

  async coalesce(key: K, fn: () => Promise<V>): Promise<V> {
    // Return existing promise if request is in flight
    if (this.pending.has(key)) {
      return this.pending.get(key)!
    }

    // Create new promise
    const promise = fn().finally(() => {
      this.pending.delete(key)
    })

    this.pending.set(key, promise)
    return promise
  }

  clear(): void {
    this.pending.clear()
  }
}

/**
 * Adaptive polling - increase interval if data hasn't changed
 */
export class AdaptivePoller<T> {
  private lastValue: T | null = null
  private minInterval: number = 1000
  private maxInterval: number = 30000
  private currentInterval: number
  private consecutiveNoChange: number = 0

  constructor(minInterval: number = 1000, maxInterval: number = 30000) {
    this.minInterval = minInterval
    this.maxInterval = maxInterval
    this.currentInterval = minInterval
  }

  shouldPoll(currentValue: T): boolean {
    if (this.lastValue === null) {
      this.lastValue = currentValue
      return true
    }

    if (JSON.stringify(currentValue) === JSON.stringify(this.lastValue)) {
      // No change - increase interval exponentially
      this.consecutiveNoChange++
      this.currentInterval = Math.min(
        this.currentInterval * 1.5,
        this.maxInterval
      )
      return false
    } else {
      // Change detected - reset to minimum interval
      this.lastValue = currentValue
      this.consecutiveNoChange = 0
      this.currentInterval = this.minInterval
      return true
    }
  }

  getNextInterval(): number {
    return Math.ceil(this.currentInterval)
  }

  reset(): void {
    this.currentInterval = this.minInterval
    this.consecutiveNoChange = 0
    this.lastValue = null
  }
}
