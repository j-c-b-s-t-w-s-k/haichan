import { useState, useEffect } from 'react'
import { TrendingUp, Users, Award, Zap } from 'lucide-react'
import db from '../../lib/db-client'
import { formatBrandName } from '../../lib/utils'
import { BadgesInline } from '../../lib/badge-utils'
import { batchWithRateLimit } from '../../lib/rate-limit-utils'
import { requestCache } from '../../lib/request-cache'
import { useRealtimeListener } from '../../hooks/use-realtime-subscription'

const CACHE_TTL = 10000 // 10 second cache for global stats (faster updates)

export function GlobalPoWStats() {
  const [stats, setStats] = useState({
    totalPoW: 0,
    totalUsers: 0,
    totalThreads: 0,
    totalPosts: 0,
    topMiners: [] as any[]
  })

  // Setup real-time listener using hook
  useRealtimeListener(
    'global-stats-updates',
    (message: any) => {
      if (message.type === 'stats-updated') {
        const { pointsAdded, userId } = message.data || message.payload || message
        
        // Optimistic update for immediate feedback
        setStats(prev => {
          const newTopMiners = [...prev.topMiners]
          
          // Update user if present in top miners
          if (userId) {
            const minerIndex = newTopMiners.findIndex(m => m.id === userId)
            if (minerIndex >= 0) {
              newTopMiners[minerIndex] = {
                ...newTopMiners[minerIndex],
                totalPowPoints: (Number(newTopMiners[minerIndex].totalPowPoints) || 0) + pointsAdded
              }
              // Re-sort top miners
              newTopMiners.sort((a, b) => Number(b.totalPowPoints) - Number(a.totalPowPoints))
            }
          }
          
          return {
            ...prev,
            totalPoW: prev.totalPoW + (pointsAdded || 0),
            topMiners: newTopMiners
          }
        })

        // Invalidate cache but delay full reload to prevent flickering/rate-limiting
        requestCache.invalidatePattern(/global-stats-/)
      } else if (message.type === 'pow-submitted' || message.type === 'user-registered') {
        requestCache.invalidatePattern(/global-stats-/)
        loadStats()
      }
    }
  )

  useEffect(() => {
    loadStats()

    // Polling fallback for when realtime is unavailable (e.g. strict firewall or guest users)
    const interval = setInterval(() => {
      // We rely on CACHE_TTL to prevent spamming, but this ensures we fetch fresh data periodically
      loadStats()
    }, 10000)

    return () => clearInterval(interval)
  }, [])

  const loadStats = async () => {
    try {
      // Use batch requests with rate limiting and caching with larger TTL
      const [users, threads, posts] = await Promise.all([
        requestCache.getOrFetch(
          'global-stats-users',
          () => batchWithRateLimit(
            [() => db.db.users.list({ limit: 100, orderBy: { totalPowPoints: 'desc' } })],
            1,
            { maxRetries: 5, initialDelayMs: 300 } // Slower backoff for less frequent requests
          ),
          CACHE_TTL
        ).then((results: any[]) => results[0]),
        
        requestCache.getOrFetch(
          'global-stats-threads',
          () => batchWithRateLimit(
            [() => db.db.threads.list({ limit: 500 })], // Reduced from 1000
            1,
            { maxRetries: 5, initialDelayMs: 300 }
          ),
          CACHE_TTL
        ).then((results: any[]) => results[0]),
        
        requestCache.getOrFetch(
          'global-stats-posts',
          () => batchWithRateLimit(
            [() => db.db.posts.list({ limit: 500 })], // Reduced from 1000
            1,
            { maxRetries: 5, initialDelayMs: 300 }
          ),
          CACHE_TTL
        ).then((results: any[]) => results[0])
      ])

      const totalPoW = users.reduce((sum, u) => sum + (Number(u.totalPowPoints) || 0), 0)
      const topMiners = users.slice(0, 5)

      setStats({
        totalPoW,
        totalUsers: users.length,
        totalThreads: threads.length,
        totalPosts: posts.length,
        topMiners
      })
    } catch (error: any) {
      // Silently handle rate limit errors - keep existing data
      if (error?.status !== 429 && error?.code !== 'RATE_LIMIT_EXCEEDED') {
        console.error('Failed to load stats:', error)
      }
    }
  }

  return (
    <div className="border border-foreground bg-card">
      {/* Header */}
      <div className="border-b border-foreground bg-transparent px-2 py-1 font-mono text-xs font-bold">
        global pow statistics
      </div>

      <div className="p-2 space-y-1">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-1 font-mono text-[9px]">
          <div className="border border-foreground p-1">
            <div className="flex items-center gap-0.5 mb-0">
              <TrendingUp className="w-2 h-2" />
              <span className="font-bold">total pow</span>
            </div>
            <div className="text-sm font-bold">{stats.totalPoW.toLocaleString()}</div>
          </div>

          <div className="border border-foreground p-1">
            <div className="flex items-center gap-0.5 mb-0">
              <Users className="w-2 h-2" />
              <span className="font-bold">users</span>
            </div>
            <div className="text-sm font-bold">{stats.totalUsers}</div>
          </div>

          <div className="border border-foreground p-1">
            <div className="flex items-center gap-0.5 mb-0">
              <Zap className="w-2 h-2" />
              <span className="font-bold">threads</span>
            </div>
            <div className="text-sm font-bold">{stats.totalThreads}</div>
          </div>

          <div className="border border-foreground p-1">
            <div className="flex items-center gap-0.5 mb-0">
              <Award className="w-2 h-2" />
              <span className="font-bold">posts</span>
            </div>
            <div className="text-sm font-bold">{stats.totalPosts}</div>
          </div>
        </div>

        {/* Top Miners */}
        <div className="border border-foreground">
          <div className="border-b border-foreground bg-transparent px-1.5 py-0.5 font-mono text-[9px] font-bold">
            top miners
          </div>
          <div className="p-1.5 space-y-0 font-mono text-[9px]">
            {stats.topMiners.map((miner, index) => (
              <div key={miner.id} className="flex items-center justify-between">
                <span className="flex items-center">
                  <span className="font-bold">#{index + 1}</span>{' '}
                  <span>{formatBrandName(miner.username) || 'Anonymous'}</span>
                  <BadgesInline user={miner} className="ml-0.5" />
                </span>
                <span className="font-bold">{Number(miner.totalPowPoints || 0).toLocaleString()}</span>
              </div>
            ))}
            {stats.topMiners.length === 0 && (
              <div className="text-center text-muted-foreground py-1 text-[8px]">no miners yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}