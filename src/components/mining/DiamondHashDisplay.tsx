import { useEffect, useState, useRef } from 'react'
import { Award, Crown } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import db from '../../lib/db-client'
import { requestCache } from '../../lib/request-cache'
import type { RealtimeChannel } from '@blinkdotnew/sdk'

interface Achievement {
  level: number
  hash: string
  achievedAt: string
}

export function DiamondHashDisplay() {
  const { authState } = useAuth()
  const [user, setUser] = useState<any>(null)
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!user?.id) return

    let channel: RealtimeChannel | null = null

    const initRealtime = async () => {
      // Subscribe to mining updates channel
      channel = db.realtime.channel('mining-updates')
      await channel.subscribe({ userId: user.id })

      // Listen for mining completion events
      channel.onMessage((message) => {
        if (message.type === 'mining-complete' && message.userId === user.id) {
          console.log('Mining completion received via realtime:', message.data)
          // Reload user data when mining completes
          loadUserData()
        }
      })

      channelRef.current = channel
    }

    initRealtime().catch(console.error)

    return () => {
      channel?.unsubscribe()
    }
  }, [user?.id])

  useEffect(() => {
    loadUserData()
  }, [])

  const loadUserData = async () => {
    try {
      const currentUser = authState.user
      if (currentUser) {
        setUser(currentUser)
        
        // Cache achievements with 30s TTL
        const userAchievements = await requestCache.getOrFetch(
          `achievements-${currentUser.id}`,
          () => db.db.achievements.list({
            where: { userId: currentUser.id },
            orderBy: { level: 'desc' }
          }),
          30000
        )
        
        setAchievements(userAchievements as any)
      }
    } catch (error) {
      console.error('Failed to load user data:', error)
    }
  }

  const getLevelColor = (level: number) => {
    if (level >= 8) return 'text-purple-500'
    if (level >= 6) return 'text-blue-500'
    if (level >= 4) return 'text-green-500'
    if (level >= 2) return 'text-yellow-500'
    return 'text-gray-500'
  }

  return (
    <div className="bg-background border-2 border-foreground p-6">
      <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-foreground">
        <Crown className="w-6 h-6" />
        <h2 className="text-xl font-bold font-mono">DIAMOND HASH</h2>
      </div>

      <div className="mb-6">
        <div className="text-sm text-muted-foreground mb-2">Personal 21e8 Diamond Hash Levels</div>
        <div className="grid grid-cols-10 gap-1">
          {Array.from({ length: 10 }, (_, i) => {
            const level = i + 1
            const achieved = achievements.some(a => a.level === level)
            return (
              <div
                key={level}
                className={`
                  aspect-square border-2 flex items-center justify-center font-mono text-xs font-bold
                  ${achieved ? 'border-foreground bg-foreground text-background' : 'border-foreground/20 text-muted-foreground'}
                `}
              >
                {level}
              </div>
            )
          })}
        </div>
      </div>

      {achievements.length > 0 && (
        <div>
          <div className="text-sm text-muted-foreground mb-2">Unlocked Diamond Hashes</div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {achievements.map((achievement) => (
              <div
                key={achievement.level}
                className="border-2 border-foreground p-3 font-mono text-xs"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Award className={`w-4 h-4 ${getLevelColor(achievement.level)}`} />
                    <span className="font-bold">Level {achievement.level}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {'0'.repeat(achievement.level)} trailing zeros
                  </span>
                </div>
                <div className="text-muted-foreground break-all">
                  {achievement.hash}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {achievements.length === 0 && (
        <div className="text-center text-muted-foreground py-8">
          No diamond hashes unlocked yet. Keep mining!
        </div>
      )}
    </div>
  )
}
