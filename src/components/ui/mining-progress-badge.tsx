import { Loader2 } from 'lucide-react'

interface MiningProgressBadgeProps {
  show: boolean
  className?: string
}

export function MiningProgressBadge({ show, className = '' }: MiningProgressBadgeProps) {
  if (!show) return null

  return (
    <div 
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-500 text-white text-[9px] font-mono font-bold ${className}`}
      title="Mining in progress for this content"
    >
      <Loader2 className="w-2.5 h-2.5 animate-spin" />
      <span>MINING...</span>
    </div>
  )
}
