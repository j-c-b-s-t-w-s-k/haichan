import { useEffect, useRef } from 'react'
import { subscribeToChannel } from '../lib/realtime-manager'

/**
 * Hook to manage real-time subscriptions with deduplication.
 * Uses the global realtime-manager to ensure single subscription per channel.
 * 
 * @param channelName - The channel to subscribe to
 * @param onMessage - Callback when a message arrives
 * @param enabled - Whether to enable the subscription (defaults to true)
 */
export function useRealtimeSubscription(
  channelName: string,
  onMessage: (message: any) => void,
  enabled: boolean = true
) {
  const listenerIdRef = useRef(Math.random().toString(36).substring(7))
  const messageHandlerRef = useRef(onMessage)

  // Update handler ref when onMessage changes so we don't need to re-subscribe
  useEffect(() => {
    messageHandlerRef.current = onMessage
  }, [onMessage])

  useEffect(() => {
    if (!enabled) return

    let unsubscribe: (() => void) | null = null
    let isMounted = true

    const setupSubscription = async () => {
      try {
        const unsubFn = await subscribeToChannel(
          channelName,
          listenerIdRef.current,
          (message) => {
            if (isMounted && messageHandlerRef.current) {
              messageHandlerRef.current(message)
            }
          }
        )
        
        if (isMounted) {
          unsubscribe = unsubFn
        } else {
          // Component unmounted during setup, clean up immediately
          unsubFn()
        }
      } catch (error) {
        console.error(`Failed to setup realtime subscription for ${channelName}:`, error)
      }
    }

    setupSubscription()

    return () => {
      isMounted = false
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [channelName, enabled])
}

/**
 * Hook to listen for real-time updates on a channel.
 * Automatically manages subscription lifecycle.
 * Multiple components can listen to the same channel without creating duplicate subscriptions.
 * 
 * @param channelName - The channel to listen to
 * @param handler - Function called with message data when updates arrive
 * @param messageTypes - Optional array of message types to filter on (if not provided, all messages are handled)
 * @param enabled - Whether to enable the subscription (defaults to true)
 */
export function useRealtimeListener(
  channelName: string,
  handler: (message: any) => void,
  messageTypes?: string[],
  enabled: boolean = true
) {
  const wrappedHandler = (message: any) => {
    if (messageTypes && messageTypes.length > 0) {
      if (messageTypes.includes(message.type)) {
        handler(message)
      }
    } else {
      handler(message)
    }
  }

  useRealtimeSubscription(channelName, wrappedHandler, enabled)
}