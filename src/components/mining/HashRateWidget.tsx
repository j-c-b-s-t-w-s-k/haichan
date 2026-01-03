import { useMining } from '../../hooks/use-mining'
import { TrendingUp, Activity, Zap } from 'lucide-react'
import { useState, useEffect } from 'react'

export function HashRateWidget() {
  const { sessions, backgroundSession, mouseoverSession, dedicatedSession } = useMining()
  const [totalHashRate, setTotalHashRate] = useState(0)
  const [totalPoints, setTotalPoints] = useState(0)
  const [miningMode, setMiningMode] = useState<string>('idle')

  useEffect(() => {
    const bgRate = backgroundSession?.currentProgress?.hashRate || 0
    const moRate = mouseoverSession?.currentProgress?.hashRate || 0
    const dedRate = dedicatedSession?.currentProgress?.hashRate || 0
    setTotalHashRate(bgRate + moRate + dedRate)

    const bgPoints = backgroundSession?.currentProgress?.points || 0
    const moPoints = mouseoverSession?.currentProgress?.points || 0
    const dedPoints = dedicatedSession?.currentProgress?.points || 0
    setTotalPoints(bgPoints + moPoints + dedPoints)

    // Determine mining mode
    if (dedicatedSession) {
      setMiningMode('dedicated')
    } else if (mouseoverSession) {
      setMiningMode('mouseover')
    } else if (backgroundSession) {
      setMiningMode('background')
    } else {
      setMiningMode('idle')
    }
  }, [sessions, backgroundSession, mouseoverSession, dedicatedSession])

  const getModeColor = () => {
    switch (miningMode) {
      case 'dedicated': return 'text-yellow-400'
      case 'mouseover': return 'text-blue-400'
      case 'background': return 'text-green-400'
      default: return 'text-gray-500'
    }
  }

  const getModeLabel = () => {
    switch (miningMode) {
      case 'dedicated': return 'DEDICATED'
      case 'mouseover': return 'MOUSEOVER'
      case 'background': return 'RUNOFF'
      default: return 'IDLE'
    }
  }

  // Hide when idle (no hash rate and no points)
  if (totalHashRate === 0 && totalPoints === 0) {
    return null
  }

  return (
    <div className="hidden md:flex items-center gap-3 px-3 py-1.5 border-2 border-black bg-white text-black font-mono text-xs">
      <div className="flex items-center gap-1">
        <Activity className="w-3.5 h-3.5" />
        <span className="font-bold">{totalHashRate.toFixed(0)}</span>
        <span className="opacity-70">H/s</span>
      </div>
      
      <div className="w-px h-4 bg-black opacity-30" />
      
      <div className="flex items-center gap-1">
        <TrendingUp className="w-3.5 h-3.5" />
        <span className="font-bold">{totalPoints}</span>
        <span className="opacity-70">pts</span>
      </div>
      
      <div className="w-px h-4 bg-black opacity-30" />
      
      <div className={`flex items-center gap-1 font-bold ${getModeColor()}`}>
        <Zap className="w-3.5 h-3.5" />
        <span>{getModeLabel()}</span>
      </div>
    </div>
  )
}