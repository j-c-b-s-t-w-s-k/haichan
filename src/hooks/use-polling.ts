import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * Advanced polling hook with adaptive intervals and cache-aware refreshing
 * 
 * Features:
 * - Automatic polling with configurable intervals
 * - Pause/resume capability
 * - Exponential backoff on errors
 * - Cache integration
 * - Page visibility awareness (stops when tab inactive)
 * - Manual refresh trigger
 */

interface UsePollingOptions<T> {
  /** Fetch function to poll */
  fetchFn: () => Promise<T>
  /** Initial poll interval in milliseconds */
  interval: number
  /** Enable/disable polling */
  enabled?: boolean
  /** Stop polling when page is hidden */
  pauseOnHidden?: boolean
  /** Exponential backoff on errors */
  backoffOnError?: boolean
  /** Maximum backoff interval */
  maxBackoffInterval?: number
  /** Callback when data changes */
  onDataChange?: (data: T) => void
  /** Callback on error */
  onError?: (error: any) => void
}

export function usePolling<T>({
  fetchFn,
  interval,
  enabled = true,
  pauseOnHidden = true,
  backoffOnError = true,
  maxBackoffInterval = 60000,
  onDataChange,
  onError
}: UsePollingOptions<T>) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<any>(null)
  const [isPaused, setIsPaused] = useState(false)
  const [currentInterval, setCurrentInterval] = useState(interval)
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const isVisibleRef = useRef(true)
  const errorCountRef = useRef(0)
  const lastDataRef = useRef<T | null>(null)

  // Manual refresh function
  const refresh = useCallback(async () => {
    if (!enabled) return

    try {
      setLoading(true)
      setError(null)
      
      const result = await fetchFn()
      
      // Reset error count on success
      errorCountRef.current = 0
      setCurrentInterval(interval)
      
      // Check if data actually changed
      const dataChanged = JSON.stringify(result) !== JSON.stringify(lastDataRef.current)
      
      setData(result)
      lastDataRef.current = result
      
      if (dataChanged && onDataChange) {
        onDataChange(result)
      }
    } catch (err) {
      console.error('Polling error:', err)
      setError(err)
      
      if (onError) {
        onError(err)
      }
      
      // Exponential backoff on error
      if (backoffOnError) {
        errorCountRef.current++
        const backoffInterval = Math.min(
          interval * Math.pow(2, errorCountRef.current),
          maxBackoffInterval
        )
        setCurrentInterval(backoffInterval)
      }
    } finally {
      setLoading(false)
    }
  }, [fetchFn, enabled, interval, backoffOnError, maxBackoffInterval, onDataChange, onError])

  // Setup polling interval
  useEffect(() => {
    if (!enabled || isPaused) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // Initial fetch
    refresh()

    // Setup interval
    intervalRef.current = setInterval(() => {
      // Skip if page is hidden and pauseOnHidden is true
      if (pauseOnHidden && !isVisibleRef.current) {
        return
      }
      
      refresh()
    }, currentInterval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [enabled, isPaused, currentInterval, pauseOnHidden, refresh])

  // Handle page visibility
  useEffect(() => {
    if (!pauseOnHidden) return

    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden
      
      // Refresh immediately when page becomes visible again
      if (!document.hidden && enabled && !isPaused) {
        refresh()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [pauseOnHidden, enabled, isPaused, refresh])

  return {
    data,
    loading,
    error,
    refresh,
    pause: () => setIsPaused(true),
    resume: () => setIsPaused(false),
    isPaused,
    currentInterval
  }
}

/**
 * Simplified polling hook for common use cases
 */
export function useSimplePolling<T>(
  fetchFn: () => Promise<T>,
  interval: number = 5000
) {
  return usePolling({
    fetchFn,
    interval,
    enabled: true,
    pauseOnHidden: true,
    backoffOnError: true
  })
}

/**
 * Polling hook with cache integration
 * Combines polling with request cache for optimal performance
 */
export function useCachedPolling<T>({
  cacheKey,
  fetchFn,
  interval,
  cacheTTL,
  enabled = true
}: {
  cacheKey: string
  fetchFn: () => Promise<T>
  interval: number
  cacheTTL: number
  enabled?: boolean
}) {
  const { requestCache } = require('../lib/request-cache')
  
  const cachedFetchFn = useCallback(async () => {
    return requestCache.getOrFetch(cacheKey, fetchFn, cacheTTL)
  }, [cacheKey, fetchFn, cacheTTL])

  return usePolling({
    fetchFn: cachedFetchFn,
    interval,
    enabled,
    pauseOnHidden: true,
    backoffOnError: true,
    onDataChange: () => {
      // Invalidate cache when polling detects new data
      requestCache.invalidate(cacheKey)
    }
  })
}
