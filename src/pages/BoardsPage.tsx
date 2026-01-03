import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp } from 'lucide-react'
import db from '../lib/db-client'
import { requestCache } from '../lib/request-cache'
import { ChatView } from '../components/views/ChatView'
import { GlobalPoWStats } from '../components/views/GlobalPoWStats'
import { BlogView } from '../components/views/BlogView'
import { BoardMiningWidget } from '../components/views/BoardMiningWidget'
import { subscribeToChannel } from '../lib/realtime-manager'

export function BoardsPage() {
  const [boards, setBoards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBoardForMining, setSelectedBoardForMining] = useState<string | null>(null)

  useEffect(() => {
    let unsubscribe: (() => void) | null = null
    
    const initializeData = async () => {
      // Load initial boards
      await loadBoards()
      
      // Setup real-time subscription for instant updates
      try {
        unsubscribe = await subscribeToChannel(
          'boards-updates',
          'boards-page',
          (message: any) => {
            if (message.type === 'board-created' || message.type === 'board-updated' || message.type === 'board-deleted') {
              // Invalidate cache and reload instantly
              requestCache.invalidate('page-boards')
              loadBoards()
            }
          }
        )

        // Listen for global PoW stats to update board totals live
        const unsubscribePoW = await subscribeToChannel(
          'global-stats-updates',
          'boards-page-pow',
          (message: any) => {
            if (message.type === 'stats-updated') {
              const { targetType, targetId, pointsAdded } = message.payload || message
              
              if (targetType === 'board') {
                setBoards(prevBoards => 
                  prevBoards.map(board => 
                    board.id === targetId 
                      ? { ...board, totalPow: (board.totalPow || 0) + pointsAdded }
                      : board
                  )
                )
              }
            }
          }
        )
        
        // Chain unsubscribe
        const oldUnsubscribe = unsubscribe
        unsubscribe = () => {
          oldUnsubscribe && oldUnsubscribe()
          unsubscribePoW && unsubscribePoW()
        }
      } catch (error) {
        console.error('Failed to setup boards real-time:', error)
      }
    }
    
    initializeData()
    
    // Polling fallback for boards data (10s interval)
    // Ensures board stats update even if realtime is unavailable
    const interval = setInterval(() => {
      loadBoards()
    }, 10000)
    
    return () => {
      unsubscribe?.()
      clearInterval(interval)
    }
  }, [])

  const handleMineComplete = (boardId: string, powPoints: number) => {
    // Update the board in the local state
    setBoards(boards.map(b => 
      b.id === boardId 
        ? { ...b, totalPow: (b.totalPow || 0) + powPoints }
        : b
    ))
  }

  const loadBoards = async () => {
    try {
      const allBoards = await requestCache.getOrFetch(
        'page-boards',
        () => db.db.boards.list({
          where: { expired: '0' },
          orderBy: { totalPow: 'desc' }
        }),
        5000 // 5 second cache - real-time updates will invalidate when needed
      )
      setBoards(allBoards)
    } catch (error: any) {
      console.error('Failed to load boards:', error)
      // Handle rate limit gracefully
      if (error?.status === 429) {
        console.warn('Rate limit hit loading boards - will retry automatically')
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center font-mono">
          <div className="text-2xl mb-2">LOADING...</div>
          <div className="text-gray-500">Fetching boards</div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="container mx-auto p-3 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Left Column - Boards */}
          <div className="lg:col-span-2 space-y-3">
            {/* Boards Section - 4chan style */}
            <div className="border border-foreground">
              <div className="border-b border-foreground bg-muted px-2 py-1 font-bold text-xs">
                Boards
              </div>
              <div className="p-3">
                {boards.length > 0 ? (
                  <div className="space-y-2">
                    {boards.map((board) => (
                      <div key={board.id} className="border-b border-foreground/30 pb-2 last:border-0">
                        <div className="flex items-baseline gap-2">
                          <Link
                            to={`/board/${board.slug}`}
                            className="font-bold text-sm hover:underline"
                          >
                            /{board.slug}/
                          </Link>
                          <span className="text-xs text-muted-foreground flex-1">
                            {board.description || 'No description'}
                          </span>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {board.totalPow || 0} PoW
                          </span>
                          <button
                            onClick={() => setSelectedBoardForMining(board.id)}
                            className={`text-[10px] font-mono font-bold px-2 py-0.5 border border-foreground transition-colors ${
                              selectedBoardForMining === board.id
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-transparent hover:bg-muted'
                            }`}
                          >
                            MINE
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground text-xs">
                    No boards yet
                  </div>
                )}
              </div>
            </div>

            <BlogView />
          </div>

          {/* Right Column - Mining, Chat & Stats */}
          <div className="space-y-3">
            {/* Board Mining Widget */}
            {selectedBoardForMining ? (
              boards.find(b => b.id === selectedBoardForMining) && (
                <BoardMiningWidget 
                  board={boards.find(b => b.id === selectedBoardForMining)!}
                  onMineComplete={(powPoints) => {
                    handleMineComplete(selectedBoardForMining, powPoints)
                  }}
                />
              )
            ) : (
              <div className="border border-foreground p-3 bg-muted">
                <p className="font-mono text-xs text-muted-foreground text-center">Select a board to mine PoW</p>
              </div>
            )}
            
            <GlobalPoWStats />
            <ChatView />
          </div>
        </div>
      </div>
    </div>
  )
}
