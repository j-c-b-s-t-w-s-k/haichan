import { useRef, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, MessageCircle, User, Clock, Loader2 } from 'lucide-react'
import { useMouseoverMining, useMining } from '../../hooks/use-mining'
import { MiningProgressBadge } from '../ui/mining-progress-badge'
import { CircularOrbImage } from '../ui/circular-orb-image'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '../ui/hover-card'
import { invokeFunction } from '../../lib/functions-utils'
import { useAuth } from '../../contexts/AuthContext'

interface ThreadCardProps {
  thread: any
  boardSlug: string
  replyCount?: number
}

function ThreadCard({ thread, boardSlug, replyCount = 0 }: ThreadCardProps) {
  const { useAttachTo } = useMouseoverMining('thread', thread.id)
  const { mouseoverSession } = useMining()
  const elementRef = useRef<HTMLDivElement>(null)
  const { authState } = useAuth()
  const [displayPow, setDisplayPow] = useState(thread.totalPow || 0)
  const [lastSubmittedHash, setLastSubmittedHash] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Check if this thread is currently being mined
  const isMining = mouseoverSession?.targetId === thread.id
  
  // Sync displayPow with thread prop if it updates from parent
  useEffect(() => {
    setDisplayPow(thread.totalPow || 0)
  }, [thread.totalPow])

  // Properly attach event listeners with cleanup
  useEffect(() => {
    if (elementRef.current) {
      const cleanup = useAttachTo(elementRef.current)
      return cleanup
    }
  }, [useAttachTo])
  
  // Auto-submit mining progress
  useEffect(() => {
    if (isMining && mouseoverSession?.currentProgress) {
      const { hash, points, nonce, trailingZeros } = mouseoverSession.currentProgress
      
      // Submit if points >= 12 AND hash starts with "21e8" (Backend requirement)
      // Worker calculates 12 points for "21e8" prefix, but might calculate >12 for "21e000" which backend rejects
      if (points >= 12 && hash.startsWith('21e8') && hash !== lastSubmittedHash && !isSubmitting) {
        handleAutoSubmit(hash, nonce, points, trailingZeros)
      }
    }
  }, [isMining, mouseoverSession, lastSubmittedHash, isSubmitting])

  const handleAutoSubmit = async (hash: string, nonce: string, points: number, trailingZeros: number) => {
    try {
      setIsSubmitting(true)
      setLastSubmittedHash(hash) // Mark as submitted immediately to prevent dupes
      
      const { MiningManager } = await import('../../lib/mining/MiningManager')
      const manager = MiningManager.getInstance()
      // @ts-ignore
      const challenge = manager.engine.getCurrentChallenge()

      const { data, error } = await invokeFunction('validate-pow', {
        body: {
          challenge,
          nonce,
          hash,
          points,
          trailingZeros,
          targetType: 'thread',
          targetId: thread.id,
          userId: authState.user?.id
        }
      })
      
      if (error || !data?.valid) {
        console.error('Auto-submit failed:', error || data?.error)
        return
      }
      
      // Update local display
      setDisplayPow((prev: number) => prev + points)
      
      // Optional: tiny toast or indicator
      // toast.success(`+${points} PoW`) 
      
    } catch (err) {
      console.error('Auto-submit error:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const truncate = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
  }

  const cardContent = (
    <div
      ref={elementRef}
      className="border-2 border-foreground bg-card hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer h-full flex flex-col"
    >
      {/* Thread Image */}
      {thread.imageUrl && (
        <div className="w-full aspect-square border-b-2 border-foreground overflow-hidden bg-muted flex items-center justify-center relative group">
          <div className={(thread.totalPow || 0) < 50 ? 'blur-sm transition-all duration-500 w-full h-full' : 'w-full h-full'}>
            <CircularOrbImage
              src={thread.imageUrl}
              alt={thread.title}
              size={150}
              className="w-full h-full"
            />
          </div>
          {(thread.totalPow || 0) < 50 && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
              <div className="bg-black text-white text-[10px] font-mono px-1 py-0.5 border border-white">
                LOW RES
              </div>
            </div>
          )}
        </div>
      )}

      {/* Thread Info */}
      <div className="p-2 flex-1 flex flex-col">
        <h3 className="font-mono font-bold text-sm mb-1 line-clamp-2 flex items-start gap-1">
          <span className="flex-1">{truncate(thread.title, 50)}</span>
          {isMining && <MiningProgressBadge show={true} />}
        </h3>
        
        <p className="font-mono text-xs text-gray-600 mb-2 line-clamp-3 flex-1">
          {truncate(thread.content, 100)}
        </p>

        <div className="space-y-1 text-xs font-mono">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 truncate flex-1">
              {thread.username || 'Anonymous'}
            </span>
            <span className="font-bold flex items-center gap-1 ml-2 text-green-700">
              {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <TrendingUp className="w-3 h-3" />}
              {displayPow}
            </span>
          </div>
          <div className="text-gray-600 border-t border-gray-300 pt-1">
            {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <div className="h-full w-full block">
          <Link to={`/board/${boardSlug}/thread/${thread.id}`} className="block h-full w-full">
            {cardContent}
          </Link>
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 font-mono text-sm border-2 border-black bg-white text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" side="right">
        <div className="space-y-3">
          <div>
            <h4 className="font-bold text-base mb-1 line-clamp-2">{thread.title}</h4>
            <p className="text-xs text-gray-600 mb-2">{truncate(thread.content, 200)}</p>
          </div>
          
          <div className="space-y-2 border-t border-gray-300 pt-2">
            <div className="flex items-center gap-2">
              <User className="w-3 h-3" />
              <span className="text-xs">
                <span className="font-bold">Poster:</span> {thread.username || 'Anonymous'}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <MessageCircle className="w-3 h-3" />
              <span className="text-xs">
                <span className="font-bold">Replies:</span> {replyCount}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3 h-3" />
              <span className="text-xs">
                <span className="font-bold">Total PoW:</span> {thread.totalPow || 0}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3" />
              <span className="text-xs">
                <span className="font-bold">Created:</span> {formatDate(thread.createdAt)}
              </span>
            </div>
          </div>
          
          <div className="text-xs text-gray-500 border-t border-gray-300 pt-2">
            Click to view thread
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

interface BoardCatalogProps {
  threads: any[]
  boardSlug: string
}

export function BoardCatalog({ threads, boardSlug }: BoardCatalogProps) {
  if (threads.length === 0) {
    return (
      <div className="border-2 border-foreground p-8 text-center">
        <p className="font-mono text-muted-foreground">No threads yet. Create the first thread.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {threads.map((thread) => (
        <ThreadCard 
          key={thread.id} 
          thread={thread} 
          boardSlug={boardSlug}
          replyCount={thread.replyCount || 0}
        />
      ))}
    </div>
  )
}