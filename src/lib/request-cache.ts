/**
 * Simple in-memory cache with TTL for request caching
 * Reduces DB load by caching frequent queries
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

class RequestCache {
  private cache = new Map<string, CacheEntry<any>>()

  /**
   * Get cached data or fetch fresh data
   */
  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlMs: number = 5000
  ): Promise<T> {
    const cached = this.cache.get(key)

    if (cached && Date.now() < cached.expiresAt) {
      return cached.data
    }

    // Fetch fresh data
    const data = await fetchFn()

    // Cache it
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs
    })

    return data
  }

  /**
   * Invalidate specific cache key
   */
  invalidate(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Invalidate keys matching a pattern
   */
  invalidatePattern(pattern: RegExp): void {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size
  }
}

export const requestCache = new RequestCache()
