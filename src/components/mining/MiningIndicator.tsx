import { useMining } from '../../hooks/use-mining'
import { Hash, Zap, Award, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import { POW_ESTIMATED_TIME } from '../../lib/constants'

export function MiningIndicator() {
  const { backgroundSession, mouseoverSession, dedicatedSession, stopAllMining } = useMining()
  const [isMinimized, setIsMinimized] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  // Timer for display
  useEffect(() => {
    if (!backgroundSession && !mouseoverSession && !dedicatedSession) {
      setElapsed(0)
      return
    }

    const interval = setInterval(() => {
      setElapsed(prev => prev + 1)
    }, 100)

    return () => clearInterval(interval)
  }, [backgroundSession, mouseoverSession, dedicatedSession])

  const handleClose = () => {
    stopAllMining()
    setIsMinimized(true)
  }

  const isActiveMining = backgroundSession || mouseoverSession || dedicatedSession
  const sessionTime = (elapsed / 10).toFixed(1)
  const remainingTime = Math.max(0, POW_ESTIMATED_TIME - parseFloat(sessionTime)).toFixed(1)

  if (isMinimized) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black border-4 border-white min-w-[320px] font-mono text-xs overflow-hidden shadow-2xl">
      {/* Top Bar - PROMINENT */}
      <div className="bg-white text-black px-3 py-2 flex items-center justify-between border-b-4 border-black">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 animate-pulse" />
          <span className="font-black text-sm">⚡ PROOF OF WORK ⚡</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setIsMinimized(true)}
            className="w-6 h-6 flex items-center justify-center hover:bg-black hover:text-white border-2 border-black text-xs font-bold transition"
            title="Minimize"
          >
            _
          </button>
          <button
            onClick={handleClose}
            className="w-6 h-6 flex items-center justify-center hover:bg-black hover:text-white border-2 border-black transition"
            title="Close mining"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 bg-black text-white">
        {isActiveMining ? (
          <>
            {/* Prominent Timer */}
            <div className="mb-4 border-4 border-white bg-white text-black p-2 text-center">
              <div className="text-xs font-bold mb-1">ESTIMATED TIME</div>
              <div className="text-3xl font-black font-mono">
                {remainingTime}s
              </div>
              <div className="text-xs mt-1 opacity-70">
                {sessionTime}s elapsed
              </div>
            </div>

            {/* Background Mining (Runoff) */}
            {backgroundSession && (
              <div className="mb-3 border-l-4 border-green-400 pl-2">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="font-bold text-green-400">RUNOFF (Background)</span>
                </div>
                <div className="text-[9px] text-gray-400 mb-1">
                  Mining to your personal diamond hash
                </div>
                {backgroundSession.currentProgress && (
                  <div className="ml-3 text-gray-300 text-xs">
                    <div className="truncate font-mono text-[10px]">
                      {backgroundSession.currentProgress.hash.substring(0, 20)}...
                    </div>
                    <div className="flex gap-3 mt-1 font-bold">
                      <span className="text-green-300">BEST: {backgroundSession.currentProgress.points}</span>
                      <span className="text-green-300">TOTAL: {backgroundSession.accumulatedPoints}</span>
                      <span className="text-green-300">RATE: {backgroundSession.currentProgress.hashRate.toFixed(0)} H/s</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mouseover Mining */}
            {mouseoverSession && (
              <div className="mb-3 border-l-4 border-blue-400 pl-2">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                  <span className="font-bold text-blue-400">
                    MOUSEOVER ({mouseoverSession.targetType})
                  </span>
                </div>
                <div className="text-[9px] text-gray-400 mb-1">
                  PoW contributes to {mouseoverSession.targetType}
                </div>
                {mouseoverSession.currentProgress && (
                  <div className="ml-3 text-gray-300 text-xs">
                    <div className="truncate font-mono text-[10px]">
                      {mouseoverSession.currentProgress.hash.substring(0, 20)}...
                    </div>
                    <div className="flex gap-3 mt-1 font-bold">
                      <span className="text-blue-300">PTS: {mouseoverSession.currentProgress.points}</span>
                      <span className="text-blue-300">◇: {mouseoverSession.currentProgress.trailingZeros}</span>
                      <span className="text-blue-300">RATE: {mouseoverSession.currentProgress.hashRate.toFixed(0)} H/s</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Dedicated Mining */}
            {dedicatedSession && (
              <div className="mb-3 border-l-4 border-yellow-400 pl-2">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                  <span className="font-bold text-yellow-400">
                    DEDICATED ({dedicatedSession.targetType})
                  </span>
                </div>
                <div className="text-[9px] text-gray-400 mb-1">
                  Full power to {dedicatedSession.targetId ? `${dedicatedSession.targetType} ${dedicatedSession.targetId.substring(0, 8)}` : dedicatedSession.targetType}
                </div>
                {dedicatedSession.currentProgress && (
                  <div className="ml-3 text-gray-300 text-xs">
                    <div className="truncate font-mono text-[10px]">
                      {dedicatedSession.currentProgress.hash.substring(0, 20)}...
                    </div>
                    <div className="flex gap-3 mt-1 font-bold">
                      <span className="text-yellow-300">PTS: {dedicatedSession.currentProgress.points}</span>
                      <span className="text-yellow-300">◇: {dedicatedSession.currentProgress.trailingZeros}</span>
                      <span className="text-yellow-300">RATE: {dedicatedSession.currentProgress.hashRate.toFixed(0)} H/s</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-4 text-gray-500">
            <div className="text-sm">No active mining</div>
          </div>
        )}
      </div>
    </div>
  )
}
