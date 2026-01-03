import { Zap } from 'lucide-react'

export function MiningStatusBadge() {
  return (
    <div className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-[10px] font-mono font-bold border border-yellow-300">
      <Zap className="w-2.5 h-2.5 animate-pulse" />
      MINING
    </div>
  )
}
