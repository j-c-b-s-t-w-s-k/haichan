import { useState, useEffect } from 'react'
import { Activity, Zap, Users, TrendingUp, Clock, Cpu } from 'lucide-react'
import db from '../../lib/db-client'
import { MiningManager } from '../../lib/mining/MiningManager'
import { requestCache } from '../../lib/request-cache'
import { throttle } from '../../lib/throttle-utils'
import { cn } from '../../lib/utils'

export function BottomToolbar() {
  const [stats, setStats] = useState({
    currentHashRate: 0,
    bestHash: '',
    onlineUsers: 0,
    globalPoW: 0,
    sessionPoints: 0,
    sessionTime: 0,
    miningMode: 'idle'
  })

  useEffect(() => {
    let startTime = Date.now()
    
    // Fetch user stats with cache (10 second TTL, max 1 request per 5 seconds)
    const fetchUserStats = throttle(async () => {
      try {
        // Use requestCache with 10s TTL
        // Note: We fetch all users for global PoW calculation, but could be optimized
        const users = await requestCache.getOrFetch(
          'users-stats',
          () => db.db.users.list({ limit: 100 }),
          10000
        )
        return users
      } catch (error) {
        console.error('Failed to fetch user stats:', error)
        // Return empty array if fetch fails
        return []
      }
    }, 5000)
    
    const updateStats = async () => {
      try {
        const manager = MiningManager.getInstance()
        const sessions = manager.getActiveSessions()
        
        // Fetch user stats with throttling
        const users = await fetchUserStats()
        const globalPoW = (users && Array.isArray(users)) 
          ? users.reduce((sum, u) => sum + (Number(u.totalPowPoints) || 0), 0)
          : 0
        
        // Get mining status from active sessions
        let hashRate = 0
        let bestHash = 'none'
        let mode = 'idle'
        const sessionPoints = sessions.reduce((sum, s) => sum + (s.accumulatedPoints || 0), 0)
        
        // Find the most active mining session
        if (sessions.length > 0) {
          // Prioritize by mode: dedicated > mouseover > background
          const dedicatedSession = sessions.find(s => s.mode === 'dedicated')
          const mouseoverSession = sessions.find(s => s.mode === 'mouseover')
          const backgroundSession = sessions.find(s => s.mode === 'background')
          
          const currentSession = dedicatedSession || mouseoverSession || backgroundSession
          
          if (currentSession && currentSession.currentProgress) {
            // Use actual hash rate from mining progress
            hashRate = currentSession.currentProgress.hashRate || 0
            bestHash = currentSession.currentProgress.hash?.substring(0, 16) || 'mining...'
            mode = currentSession.mode
          }
        }

        setStats({
          currentHashRate: hashRate,
          bestHash,
          onlineUsers: (users && Array.isArray(users)) ? users.length : 0,
          globalPoW,
          sessionPoints,
          sessionTime: Math.floor((Date.now() - startTime) / 1000),
          miningMode: mode
        })
      } catch (error) {
        console.error('Stats update failed:', error)
      }
    }

    updateStats()
    // Increase interval from 1s to 2s to reduce load, throttle prevents excessive calls
    const interval = setInterval(updateStats, 2000)
    
    return () => clearInterval(interval)
  }, [])

  const formatHashRate = (rate: number) => {
    if (rate === 0) return '0 H/s'
    if (rate < 1000) return `${rate} H/s`
    if (rate < 1000000) return `${(rate / 1000).toFixed(1)}k H/s`
    return `${(rate / 1000000).toFixed(1)}M H/s`
  }

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const isActiveMining = stats.miningMode !== 'idle'

  return (
    <div className="fixed bottom-0 left-0 right-0 h-8 bg-background border-t border-foreground text-foreground text-[10px] md:text-xs z-50 flex items-center px-2 gap-2 md:gap-4 font-mono select-none overflow-hidden">
      {/* Mining Status */}
      <div 
        className={cn(
          "flex items-center gap-1.5 px-2 py-0.5 rounded-sm transition-colors",
          isActiveMining ? "bg-foreground text-background font-bold animate-pulse" : "text-muted-foreground"
        )}
        title={isActiveMining 
          ? `Mining Mode: ${stats.miningMode.toUpperCase()} - Hash: ${stats.bestHash}` 
          : 'No active mining'}
      >
        <Cpu className="w-3 h-3" />
        <span className="uppercase">{isActiveMining ? stats.miningMode : 'IDLE'}</span>
      </div>

      <div className="w-px h-3 bg-border" />

      {/* Hash Rate */}
      <div 
        className="flex items-center gap-1.5 min-w-[80px]" 
        title={`Current Hash Rate: ${formatHashRate(stats.currentHashRate)}`}
      >
        <Zap className={cn("w-3 h-3", isActiveMining && "text-yellow-500 fill-yellow-500")} />
        <span>{formatHashRate(stats.currentHashRate)}</span>
      </div>

      <div className="w-px h-3 bg-border hidden md:block" />

      {/* Best Hash - Desktop only */}
      <div 
        className="hidden md:flex items-center gap-1.5 flex-1 min-w-0" 
        title={`Current Best Hash: ${stats.bestHash}`}
      >
        <Activity className="w-3 h-3 text-muted-foreground" />
        <span className="truncate opacity-70 font-mono">{stats.bestHash}</span>
      </div>

      <div className="w-px h-3 bg-border" />

      {/* Session Points */}
      <div 
        className="flex items-center gap-1.5 font-bold min-w-[60px]"
        title={`Session Points: ${stats.sessionPoints}`}
      >
        <span>PTS: {stats.sessionPoints}</span>
      </div>

      <div className="w-px h-3 bg-border hidden md:block" />

      {/* Global PoW - Desktop */}
      <div 
        className="hidden md:flex items-center gap-1.5 text-muted-foreground" 
        title={`Global Proof-of-Work: ${stats.globalPoW.toLocaleString()} total points`}
      >
        <TrendingUp className="w-3 h-3" />
        <span>{stats.globalPoW.toLocaleString()}</span>
      </div>

      <div className="w-px h-3 bg-border hidden md:block" />

      {/* Online Users */}
      <div 
        className="hidden md:flex items-center gap-1.5 text-muted-foreground" 
        title={`Online Users: ${stats.onlineUsers} registered users`}
      >
        <Users className="w-3 h-3" />
        <span>{stats.onlineUsers}</span>
      </div>

      <div className="w-px h-3 bg-border" />

      {/* Session Time */}
      <div 
        className="flex items-center gap-1.5 text-muted-foreground min-w-[60px] justify-end" 
        title={`Session Duration: ${formatTime(stats.sessionTime)}`}
      >
        <Clock className="w-3 h-3" />
        <span>{formatTime(stats.sessionTime)}</span>
      </div>
    </div>
  )
}