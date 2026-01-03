/**
 * Global Realtime Subscription Manager
 * Ensures single active subscription per channel to prevent conflicts
 * Each channel can have multiple listeners without creating duplicate subscriptions
 */

import db from './db-client'

interface Listener {
  id: string
  callback: (message: any) => void
}

interface ChannelState {
  channel: any
  listeners: Map<string, Listener>
  isSubscribed: boolean
  subscriptionPromise: Promise<void> | null
}

const channels = new Map<string, ChannelState>()

/**
 * Subscribe to a realtime channel with automatic deduplication
 * Multiple components can listen to the same channel without conflicts
 */
export async function subscribeToChannel(
  channelName: string,
  listenerId: string,
  onMessage: (message: any) => void
): Promise<() => void> {
  let channelState = channels.get(channelName)

  // Create channel state if it doesn't exist
  if (!channelState) {
    channelState = {
      channel: db.realtime.channel(channelName),
      listeners: new Map(),
      isSubscribed: false,
      subscriptionPromise: null
    }
    channels.set(channelName, channelState)
  }

  // Wait for any in-progress subscription
  if (channelState.subscriptionPromise) {
    await channelState.subscriptionPromise
  }

  // Add listener
  const listener: Listener = {
    id: listenerId,
    callback: onMessage
  }
  channelState.listeners.set(listenerId, listener)

  // Subscribe to channel if not already subscribed
  if (!channelState.isSubscribed) {
    channelState.subscriptionPromise = subscribeChannelOnce(channelState)
    try {
      await channelState.subscriptionPromise
    } finally {
      channelState.subscriptionPromise = null
    }
  }

  // Return unsubscribe function for cleanup
  return () => {
    channelState!.listeners.delete(listenerId)

    // If no more listeners, unsubscribe from channel
    if (channelState!.listeners.size === 0) {
      channelState!.channel?.unsubscribe().catch(() => {
        // Ignore unsubscribe errors
      })
      channelState!.isSubscribed = false
      channels.delete(channelName)
    }
  }
}

/**
 * Actually subscribe to the channel once and setup message routing
 */
async function subscribeChannelOnce(channelState: ChannelState): Promise<void> {
  try {
    await channelState.channel.subscribe()
    channelState.isSubscribed = true

    // Setup message handler that routes to all listeners
    channelState.channel.onMessage((message: any) => {
      // Call all listeners with the message
      for (const listener of channelState.listeners.values()) {
        try {
          listener.callback(message)
        } catch (error) {
          console.error(`Error in listener ${listener.id}:`, error)
        }
      }
    })
  } catch (error) {
    channelState.isSubscribed = false
    throw error
  }
}

/**
 * Clean up all subscriptions (useful for testing or app shutdown)
 */
export async function cleanupAllSubscriptions(): Promise<void> {
  for (const channelState of channels.values()) {
    try {
      await channelState.channel.unsubscribe()
    } catch (error) {
      console.error('Error unsubscribing:', error)
    }
  }
  channels.clear()
}