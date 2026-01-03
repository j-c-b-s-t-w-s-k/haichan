import { useMining } from '../../hooks/use-mining'
import { Zap } from 'lucide-react'
import { useEffect, useState } from 'react'

export function MiningStatusBadge() {
  const { backgroundSession, mouseoverSession, dedicatedSession } = useMining()
  const [hashRate, setHashRate] = useState(0)
  
  const isActiveMining = backgroundSession || mouseoverSession || dedicatedSession
  
  // Calculate total hash rate from all active sessions
  useEffect(() => {
    const bgRate = backgroundSession?.currentProgress?.hashRate || 0
    const moRate = mouseoverSession?.currentProgress?.hashRate || 0
    const dedRate = dedicatedSession?.currentProgress?.hashRate || 0
    setHashRate(bgRate + moRate + dedRate)
  }, [backgroundSession, mouseoverSession, dedicatedSession])

  // Hide entirely when idle
  if (!isActiveMining) {
    return null
  }

  return (
    <div 
      className="flex items-center gap-1.5 px-2 py-1 border text-xs font-mono transition-all bg-green-400 text-black border-green-600 animate-pulse"
      title={`Mining active: ${hashRate.toFixed(0)} H/s`}
    >
      <Zap className="w-3 h-3" />
      <span className="font-bold">
        {hashRate.toFixed(0)} H/s
      </span>
      <div className="w-1.5 h-1.5 bg-black rounded-full animate-ping" />
    </div>
  )
}
