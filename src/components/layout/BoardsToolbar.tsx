import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import db from '../../lib/db-client'
import { requestCache } from '../../lib/request-cache'
import { withRateLimit } from '../../lib/rate-limit-utils'
import { subscribeToChannel } from '../../lib/realtime-manager'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'

export function BoardsToolbar() {
  const [boards, setBoards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubscribe: (() => void) | null = null
    
    const initializeData = async () => {
      // Load initial boards
      await loadBoards()
      
      // Setup real-time subscription for instant updates
      // Real-time is non-critical enhancement - errors are handled gracefully in realtime-manager
      unsubscribe = await subscribeToChannel(
        'boards-updates',
        'boards-toolbar',
        (message: any) => {
          if (message.type === 'board-created' || message.type === 'board-updated' || message.type === 'board-deleted') {
            // Invalidate cache and reload instantly
            requestCache.invalidate('toolbar-boards')
            loadBoards()
          }
        }
      )
    }
    
    initializeData()
    
    return () => {
      unsubscribe?.()
    }
  }, [])

  const loadBoards = async () => {
    try {
      const allBoards = await requestCache.getOrFetch(
        'toolbar-boards',
        () => withRateLimit(() => db.db.boards.list({
          orderBy: { totalPow: 'desc' }
        }), { maxRetries: 5, initialDelayMs: 200 }),
        5000 // 5 second cache - real-time updates will invalidate when needed
      )
      setBoards(allBoards)
    } catch (error) {
      console.error('Failed to load boards:', error)
    } finally {
      setLoading(false)
    }
  }

  // Always render the button, but show appropriate content

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="nav-link inline-flex items-center gap-0.5">
        [Boards<ChevronDown className="w-2.5 h-2.5" />]
      </DropdownMenuTrigger>
      <DropdownMenuContent className="font-mono text-xs max-h-96 overflow-y-auto">
        <DropdownMenuItem asChild>
          <Link to="/boards" className="cursor-pointer font-bold">
            All Boards
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {loading ? (
          <DropdownMenuItem disabled>
            <span className="text-muted-foreground">Loading...</span>
          </DropdownMenuItem>
        ) : boards.length === 0 ? (
          <DropdownMenuItem disabled>
            <span className="text-muted-foreground">No boards available</span>
          </DropdownMenuItem>
        ) : (
          boards.map((board) => (
            <DropdownMenuItem key={board.id} asChild>
              <Link
                to={`/board/${board.slug}`}
                className="cursor-pointer flex justify-between gap-4"
              >
                <span>/{board.slug}/</span>
                <span className="text-muted-foreground text-[10px]">
                  {board.totalPow || 0} PoW
                </span>
              </Link>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/boards/create" className="cursor-pointer">
            + Create Board
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}