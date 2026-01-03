import { Zap, StopCircle } from 'lucide-react'
import { useMining } from '../../hooks/use-mining'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

interface MiningButtonProps {
  targetType: 'thread' | 'post' | 'image'
  targetId: string
  className?: string
  size?: 'sm' | 'default' | 'icon'
  variant?: 'default' | 'outline' | 'ghost' | 'secondary'
}

export function MiningButton({ 
  targetType, 
  targetId, 
  className,
  size = 'sm',
  variant = 'outline'
}: MiningButtonProps) {
  const { dedicatedSession, startDedicatedMining, stopDedicatedMining } = useMining()

  // Check if this specific target is being mined
  const isMiningThis = dedicatedSession?.targetType === targetType && dedicatedSession?.targetId === targetId
  
  // Check if we are mining something else
  const isMiningSomethingElse = dedicatedSession && !isMiningThis

  const handleToggleMining = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (isMiningThis) {
      stopDedicatedMining()
    } else {
      // If mining something else, this will auto-stop the previous one because 
      // MiningManager handles one dedicated session at a time usually, 
      // or we should stop it first to be safe/clear.
      // useMining's startDedicatedMining calls manager.startDedicatedMining which likely handles cleanup.
      await startDedicatedMining(targetType, targetId, 1000000) // 1,000,000 points = effectively infinite/manual stop
    }
  }

  return (
    <Button
      variant={isMiningThis ? 'default' : variant}
      size={size}
      onClick={handleToggleMining}
      className={cn(
        "font-mono text-xs transition-all duration-300", 
        isMiningThis ? "bg-amber-500 hover:bg-amber-600 text-black border-amber-600 animate-pulse" : "",
        className
      )}
      title={isMiningThis ? "Stop Mining" : "Mine this item"}
      // disabled={isMiningSomethingElse && !isMiningThis} // Allow switching by clicking new target
    >
      {isMiningThis ? (
        <>
          <StopCircle className="w-3 h-3 mr-1" />
          MINING
        </>
      ) : (
        <>
          <Zap className="w-3 h-3 mr-1" />
          MINE
        </>
      )}
    </Button>
  )
}