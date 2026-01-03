import { useState, useEffect } from 'react'
import { Users } from 'lucide-react'
import db from '../../lib/db-client'
import { formatBrandName } from '../../lib/utils'
import { BadgesInline } from '../../lib/badge-utils'
import { withRateLimit, batchWithRateLimit } from '../../lib/rate-limit-utils'
import { requestCache } from '../../lib/request-cache'
import { useRealtimeListener } from '../../hooks/use-realtime-subscription'

interface Poster {
  id: string
  username: string
  totalPowPoints: number
  diamondLevel: number
  threadCount?: number
  postCount?: number
}

const CACHE_TTL = 30000 // 30 second cache for posters list

export function PostersList() {
  const [posters, setPosters] = useState<Poster[]>([])
  const [loading, setLoading] = useState(true)

  // Load initial posters on mount
  useEffect(() => {
    loadPosters()
  }, [])

  // Setup real-time subscription for instant updates
  // Using shared hook prevents duplicate subscriptions when multiple components listen to same channel
  useRealtimeListener(
    'posters-updates',
    (message: any) => {
      if (message.type === 'poster-activity' || message.type === 'post-created' || message.type === 'thread-created') {
        // Invalidate cache and reload instantly
        requestCache.invalidate('posters-list-users')
        loadPosters()
      }
    },
    ['poster-activity', 'post-created', 'thread-created']
  )

  // Also listen for PoW updates to update scores live
  useRealtimeListener(
    'global-stats-updates',
    (message: any) => {
      if (message.type === 'stats-updated') {
        const { userId, pointsAdded } = message.payload || message
        
        if (userId) {
          setPosters(prevPosters => {
            const updated = prevPosters.map(poster => 
              poster.id === userId
                ? { ...poster, totalPowPoints: (poster.totalPowPoints || 0) + pointsAdded }
                : poster
            )
            // Re-sort if scores changed
            return updated.sort((a, b) => b.totalPowPoints - a.totalPowPoints)
          })
        }
      }
    },
    []
  )

  const loadPosters = async () => {
    try {
      // Get all active users with caching
      const users = await requestCache.getOrFetch(
        'posters-list-users',
        () => withRateLimit(
          () => db.db.users.list({
            orderBy: { totalPowPoints: 'desc' },
            limit: 50
          }),
          { maxRetries: 5, initialDelayMs: 200 }
        ),
        CACHE_TTL
      )

      // Create batch requests to check activity for each user
      const checkActivityFns = users.map(user => async () => {
        try {
          const [threads, posts] = await Promise.all([
            withRateLimit(
              () => db.db.threads.list({
                where: { userId: user.id },
                limit: 1
              }),
              { maxRetries: 3, initialDelayMs: 100 }
            ),
            withRateLimit(
              () => db.db.posts.list({
                where: { userId: user.id },
                limit: 1
              }),
              { maxRetries: 3, initialDelayMs: 100 }
            )
          ])
          
          return {
            ...user,
            hasContent: threads.length > 0 || posts.length > 0
          }
        } catch (error) {
          console.warn(`Failed to check activity for user ${user.id}:`, error)
          return { ...user, hasContent: false }
        }
      })

      // Process in batches to avoid overwhelming the API
      const activeUsers = await batchWithRateLimit(
        checkActivityFns,
        3, // Process 3 users in parallel at a time
        { maxRetries: 3, initialDelayMs: 100 }
      )

      const activePostersList = activeUsers
        .filter(u => u.hasContent)
        .map(user => ({
          id: user.id,
          username: user.username || user.displayName || 'Anonymous',
          totalPowPoints: Number(user.totalPowPoints) || 0,
          diamondLevel: Number(user.diamondLevel) || 0
        }))
        .sort((a, b) => b.totalPowPoints - a.totalPowPoints)

      setPosters(activePostersList)
    } catch (error: any) {
      // Silently handle rate limit errors - keep existing data
      if (error?.status !== 429 && error?.code !== 'RATE_LIMIT_EXCEEDED') {
        console.error('Failed to load posters:', error)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border border-foreground bg-card">
      {/* Header */}
      <div className="border-b border-foreground bg-transparent px-2 py-1 font-mono text-xs font-bold flex items-center gap-1">
        <Users className="w-3 h-3" />
        <span>active posters</span>
      </div>

      {/* Posters List */}
      <div className="p-2 space-y-0 font-mono text-[9px]">
        {loading ? (
          <div className="text-center text-muted-foreground py-1 text-[8px]">loading...</div>
        ) : posters.length > 0 ? (
          posters.map((poster, index) => (
            <div key={poster.id} className="flex items-center justify-between hover:bg-muted p-1 border border-transparent hover:border-foreground">
              <span className="flex items-center">
                <span className="font-bold w-6">#{index + 1}</span>
                <span className="truncate">{formatBrandName(poster.username)}</span>
                <BadgesInline user={poster} className="ml-0.5" />
              </span>
              <span className="font-bold whitespace-nowrap ml-1">
                {Number(poster.totalPowPoints).toLocaleString()}
              </span>
            </div>
          ))
        ) : (
          <div className="text-center text-muted-foreground py-1 text-[8px]">no active posters</div>
        )}
      </div>
    </div>
  )
}