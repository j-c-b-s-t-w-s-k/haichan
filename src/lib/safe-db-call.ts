/**
 * Safe database call wrapper with automatic rate limit handling
 * Use this to wrap all database calls to prevent 429 errors
 */

import { rateLimitHandler } from './rate-limit-handler'

interface SafeCallOptions {
  retryOnRateLimit?: boolean
  timeout?: number
  fallbackValue?: any
}

/**
 * Safely execute a database call with automatic rate limit handling
 * @param fn - The database function to call
 * @param options - Configuration options
 * @returns Promise with the result or fallback value
 */
export async function safeDbCall<T>(
  fn: () => Promise<T>,
  options: SafeCallOptions = {}
): Promise<T | null> {
  const {
    retryOnRateLimit = true,
    timeout = 30000,
    fallbackValue = null
  } = options

  try {
    // Execute through rate limit handler for automatic queuing and backoff
    if (retryOnRateLimit) {
      return await rateLimitHandler.execute(fn)
    } else {
      return await fn()
    }
  } catch (error: any) {
    // Log the error for debugging
    console.error('[SafeDbCall] Error:', {
      status: error?.status,
      message: error?.message,
      code: error?.code
    })

    // Handle specific error types
    if (error?.status === 429) {
      console.warn('[SafeDbCall] Rate limit hit - returning fallback value')
      return fallbackValue as T | null
    }

    // Re-throw other errors
    throw error
  }
}

/**
 * Batch multiple database calls with proper rate limiting
 * Executes them sequentially to avoid hitting rate limits
 */
export async function batchDbCalls<T>(
  calls: Array<() => Promise<T>>,
  options: SafeCallOptions = {}
): Promise<(T | null)[]> {
  const results: (T | null)[] = []

  for (const call of calls) {
    try {
      const result = await safeDbCall(call, options)
      results.push(result)
    } catch (error) {
      console.error('[batchDbCalls] Call failed:', error)
      results.push(options.fallbackValue ?? null)
    }
  }

  return results
}
