import { useState, useEffect } from 'react'
import { Trophy, Zap, Award } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import db from '../../lib/db-client'

interface RunoffStats {
  totalPoW: number
  recentPoW: number
  diamondLevel: number
}

export function RunoffPoWDisplay() {
  const { authState } = useAuth()
  const [stats, setStats] = useState<RunoffStats>({
    totalPoW: 0,
    recentPoW: 0,
    diamondLevel: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
    // Refresh stats every 10 seconds
    const interval = setInterval(loadStats, 10000)
    return () => clearInterval(interval)
  }, [])

  const loadStats = async () => {
    try {
      const user = authState.user
      if (!user?.id) return

      // Get user's total PoW points and diamond level
      const users = await db.db.users.list({
        where: { id: user.id },
        limit: 1
      })

      if (users.length > 0) {
        const userData = users[0]
        
        // Get recent PoW (last 24 hours)
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const recentPow = await db.db.powRecords.list({
          where: {
            userId: user.id,
            createdAt: { '>': yesterday }
          }
        })

        const recentTotal = recentPow.reduce((sum, record) => {
          return sum + (Number(record.points) || 0)
        }, 0)

        setStats({
          totalPoW: Number(userData.totalPowPoints) || 0,
          recentPoW: recentTotal,
          diamondLevel: Number(userData.diamondLevel) || 0
        })
      }
    } catch (error) {
      console.error('Failed to load runoff PoW stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return null
  }

  return (
    <div className="bg-black text-white border-4 border-white p-3 font-mono">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-yellow-400" />
        <h3 className="font-bold text-sm">YOUR PROOF-OF-WORK</h3>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {/* Total PoW */}
        <div className="border-2 border-white p-2 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Trophy className="w-3 h-3 text-yellow-400" />
            <div className="text-[10px] opacity-70">TOTAL</div>
          </div>
          <div className="text-xl font-bold">
            {stats.totalPoW.toLocaleString()}
          </div>
          <div className="text-[9px] opacity-60">pts</div>
        </div>

        {/* Recent PoW (24h) */}
        <div className="border-2 border-green-400 bg-green-400/10 p-2 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Zap className="w-3 h-3 text-green-400" />
            <div className="text-[10px] opacity-70">24H</div>
          </div>
          <div className="text-xl font-bold text-green-400">
            +{stats.recentPoW.toLocaleString()}
          </div>
          <div className="text-[9px] opacity-60">pts</div>
        </div>

        {/* Diamond Level */}
        <div className="border-2 border-blue-400 bg-blue-400/10 p-2 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Award className="w-3 h-3 text-blue-400" />
            <div className="text-[10px] opacity-70">DIAMOND</div>
          </div>
          <div className="text-xl font-bold text-blue-400">
            {stats.diamondLevel > 0 ? `◇${stats.diamondLevel}` : '-'}
          </div>
          <div className="text-[9px] opacity-60">level</div>
        </div>
      </div>

      <div className="mt-2 text-[9px] text-gray-400 text-center">
        Runoff mining accumulates to your personal PoW total
      </div>
    </div>
  )
}
