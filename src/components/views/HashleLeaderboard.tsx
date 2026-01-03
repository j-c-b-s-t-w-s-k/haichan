import { useState, useEffect } from 'react'
import db from '../../lib/db-client'
import { Trophy } from 'lucide-react'

export function HashleLeaderboard() {
  const [topScorers, setTopScorers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTopScorers()
  }, [])

  const loadTopScorers = async () => {
    try {
      const users = await db.db.users.list({
        orderBy: { hashleScore: 'desc' },
        limit: 5
      })
      setTopScorers(users.filter((u: any) => Number(u.hashleScore) > 0))
    } catch (error) {
      console.error('Failed to load Hashle leaderboard:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center text-xs text-muted-foreground">Loading...</div>
  }

  return (
    <div className="border border-foreground">
      <div className="border-b border-foreground bg-muted px-2 py-1 font-bold text-xs flex items-center gap-1">
        <Trophy size={12} />
        Hashle Top Scorers
      </div>
      <div className="p-2">
        {topScorers.length > 0 ? (
          <div className="space-y-0 text-xs">
            {topScorers.map((user, i) => (
              <div key={user.id} className="flex justify-between items-center">
                <span>
                  <span className="font-bold">{i + 1}.</span> {user.username || 'anon'}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {user.hashleScore || 0}pts
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-2 text-muted-foreground text-xs">
            No scores yet
          </div>
        )}
        <div className="border-t border-foreground mt-2 pt-1 text-[10px] text-muted-foreground">
          <a href="/games" className="hover:underline">Play Hashle →</a>
        </div>
      </div>
    </div>
  )
}
