import { useState, useEffect, useCallback, useRef } from 'react'
import { MiningManager, MiningSession } from '../lib/mining/MiningManager'

export function useMining() {
  const [sessions, setSessions] = useState<MiningSession[]>([])
  const managerRef = useRef(MiningManager.getInstance())
  const unsubscribeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    // Subscribe to mining sessions
    unsubscribeRef.current = managerRef.current.subscribe((newSessions) => {
      setSessions(newSessions)
    })

    // Cleanup: unsubscribe from sessions on unmount
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
    }
  }, [])

  const startDedicatedMining = useCallback(
    async (targetType: string, targetId?: string, targetPoints?: number, prefix?: string) => {
      await managerRef.current.startDedicatedMining(targetType, targetId, targetPoints, prefix)
    },
    []
  )

  const stopDedicatedMining = useCallback(() => {
    managerRef.current.stopDedicatedMining()
  }, [])

  const stopAllMining = useCallback(() => {
    managerRef.current.stopAllMining()
  }, [])

  return {
    sessions,
    startDedicatedMining,
    stopDedicatedMining,
    stopAllMining,
    backgroundSession: sessions.find(s => s.mode === 'background'),
    mouseoverSession: sessions.find(s => s.mode === 'mouseover'),
    dedicatedSession: sessions.find(s => s.mode === 'dedicated')
  }
}

export function useMouseoverMining(targetType: string, targetId: string) {
  const managerRef = useRef(MiningManager.getInstance())
  const elementRef = useRef<HTMLElement | null>(null)
  const miningCleanupRef = useRef<(() => void) | null>(null)
  
  // Use refs for props to stabilize attachTo
  const propsRef = useRef({ targetType, targetId })
  useEffect(() => {
    propsRef.current = { targetType, targetId }
  }, [targetType, targetId])

  const listenersRef = useRef<{
    element: HTMLElement | null
    handlers: {
      enter: ((e: Event) => void) | null
      leave: ((e: Event) => void) | null
      context: ((e: MouseEvent) => void) | null
      touchStart: ((e: TouchEvent) => void) | null
      touchEnd: ((e: TouchEvent) => void) | null
    }
  }>({ element: null, handlers: { enter: null, leave: null, context: null, touchStart: null, touchEnd: null } })

  /**
   * Clean up all event listeners for the current element
   */
  const cleanupListeners = useCallback(() => {
    const { element, handlers } = listenersRef.current
    if (!element) return

    console.log('[useMouseoverMining] cleaning up listeners', { element })

    if (handlers.enter) {
      element.removeEventListener('mouseenter', handlers.enter)
      handlers.enter = null
    }
    if (handlers.leave) {
      element.removeEventListener('mouseleave', handlers.leave)
      handlers.leave = null
    }
    if (handlers.context) {
      element.removeEventListener('contextmenu', handlers.context)
      handlers.context = null
    }
    if (handlers.touchStart) {
      element.removeEventListener('touchstart', handlers.touchStart)
      handlers.touchStart = null
    }
    if (handlers.touchEnd) {
      element.removeEventListener('touchend', handlers.touchEnd)
      element.removeEventListener('touchcancel', handlers.touchEnd)
      handlers.touchEnd = null
    }

    listenersRef.current.element = null
  }, [])

  /**
   * Attach event listeners to an element with proper cleanup
   */
  const attachTo = useCallback((element: HTMLElement | null) => {
    console.log('[useMouseoverMining] attachTo called', { 
      element, 
      prevElement: elementRef.current,
      targetType: propsRef.current.targetType, 
      targetId: propsRef.current.targetId 
    })

    // Always clean up previous mining session
    if (miningCleanupRef.current) {
      console.log('[useMouseoverMining] cleaning up previous mining session')
      miningCleanupRef.current()
      miningCleanupRef.current = null
    }

    // Always clean up previous listeners
    cleanupListeners()

    if (!element) {
      elementRef.current = null
      return
    }

    elementRef.current = element
    listenersRef.current.element = element

    // Mouse handlers (Desktop)
    const handleMouseEnter = (_e: Event) => {
      // Ignore if it's likely a touch emulation (though we separate listeners now, good to be safe)
      if ('ontouchstart' in window && window.innerWidth < 768) return;

      console.log('[useMouseoverMining] mouseenter', { 
        targetType: propsRef.current.targetType, 
        targetId: propsRef.current.targetId 
      })
      if (!miningCleanupRef.current) {
        miningCleanupRef.current = managerRef.current.startMouseoverMining(
          propsRef.current.targetType,
          propsRef.current.targetId,
          element
        )
      }
    }

    const handleMouseLeave = (_e: Event) => {
      console.log('[useMouseoverMining] mouseleave')
      if (miningCleanupRef.current) {
        miningCleanupRef.current()
        miningCleanupRef.current = null
      }
    }

    // Touch handlers (Mobile)
    // We use a simple "touch-to-mine" that starts immediately on touch
    // and stops on release.
    const handleTouchStart = (e: TouchEvent) => {
      // Prevent default to stop scrolling/zooming while mining?
      // Maybe not prevent default immediately, user might want to scroll.
      // But if they hold, we want to mine.
      // Let's try starting mining immediately.
      
      console.log('[useMouseoverMining] touchstart')
      if (!miningCleanupRef.current) {
        miningCleanupRef.current = managerRef.current.startMouseoverMining(
          propsRef.current.targetType,
          propsRef.current.targetId,
          element
        )
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      console.log('[useMouseoverMining] touchend')
      if (miningCleanupRef.current) {
        miningCleanupRef.current()
        miningCleanupRef.current = null
      }
    }

    // Right-click: show hash info
    const handleContextMenu = (e: MouseEvent) => {
      // Only show alert if NOT mining (or maybe always?)
      // On mobile, long press triggers context menu. We might want to block it if we mined.
      // For now, let's keep it simple.
      e.preventDefault()
      const hash = element.getAttribute('data-mining-hash')
      const points = element.getAttribute('data-mining-points')
      console.log('[useMouseoverMining] contextmenu', { hash, points })

      if (hash) {
        alert(`SHA-256 Hash: ${hash}\nPoints: ${points || '0'}`)
      }
    }

    // Store handler references
    listenersRef.current.handlers = {
      enter: handleMouseEnter,
      leave: handleMouseLeave,
      context: handleContextMenu,
      touchStart: handleTouchStart,
      touchEnd: handleTouchEnd
    }

    // Attach listeners based on device capability
    // We attach both because hybrid devices exist (laptops with touchscreens)
    // But we guard enter/leave with checks.
    
    element.addEventListener('mouseenter', handleMouseEnter)
    element.addEventListener('mouseleave', handleMouseLeave)
    element.addEventListener('contextmenu', handleContextMenu)
    
    // Touch events for mobile
    element.addEventListener('touchstart', handleTouchStart, { passive: true })
    element.addEventListener('touchend', handleTouchEnd)
    element.addEventListener('touchcancel', handleTouchEnd)

  }, [cleanupListeners]) // Removed targetType/targetId from deps

  /**
   * Hook for useEffect integration - returns cleanup function
   */
  const useAttachTo = useCallback((element: HTMLElement | null) => {
    attachTo(element)

    // Return cleanup for useEffect
    return () => {
      // Stop mining
      if (miningCleanupRef.current) {
        miningCleanupRef.current()
        miningCleanupRef.current = null
      }
      // Remove listeners
      cleanupListeners()
      elementRef.current = null
    }
  }, [attachTo, cleanupListeners])

  /**
   * Auto-cleanup on hook unmount
   */
  useEffect(() => {
    return () => {
      if (miningCleanupRef.current) {
        miningCleanupRef.current()
        miningCleanupRef.current = null
      }
      cleanupListeners()
    }
  }, [cleanupListeners])

  return { attachTo, useAttachTo }
}