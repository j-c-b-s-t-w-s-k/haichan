import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronLeft, TrendingUp, LayoutGrid, LayoutList, Search, ArrowUpDown } from 'lucide-react'
import { useMouseoverMining, useMining } from '../hooks/use-mining'
import { useRealtimeListener } from '../hooks/use-realtime-subscription'
import { MiningProgressBadge } from '../components/ui/mining-progress-badge'
import { BoardCatalog } from '../components/views/BoardCatalog'
import { PostersFilter } from '../components/views/PostersFilter'
import { Button } from '../components/ui/button'
import db from '../lib/db-client'
import { Input } from '../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"

function ThreadRow({ thread, boardSlug, replyCount }: { thread: any; boardSlug: string; replyCount: number }) {
  const { useAttachTo } = useMouseoverMining('thread', thread.id)
  const { mouseoverSession } = useMining()
  const elementRef = useRef<HTMLTableRowElement>(null)
  
  // Check if this thread is currently being mined
  const isMining = mouseoverSession?.targetId === thread.id

  // Properly attach event listeners with cleanup
  useEffect(() => {
    if (elementRef.current) {
      const cleanup = useAttachTo(elementRef.current)
      return cleanup
    }
  }, [useAttachTo])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })
  }

  return (
    <tr
      ref={elementRef}
      className="border-b border-gunmetal hover:bg-deep-teal hover:text-celadon transition-colors"
    >
      <td className="py-3 px-4 font-bold">
        <Link to={`/board/${boardSlug}/thread/${thread.id}`} className="hover:underline">
          {thread.title}
        </Link>
        {isMining && (
          <MiningProgressBadge show={true} className="ml-2" />
        )}
      </td>
      <td className="py-3 px-4 text-center">
        {thread.username || 'Anonymous'}
      </td>
      <td className="py-3 px-4 text-center">
        {thread.replyCount || 0}
      </td>
      <td className="py-3 px-4 text-center font-bold">
        <TrendingUp className="w-4 h-4 inline mr-1" />
        {thread.totalPow || 0}
      </td>
      <td className="py-3 px-4 text-center opacity-70">
        {formatDate(thread.createdAt)}
      </td>
    </tr>
  )
}

export function ThreadsPage() {
  const { boardSlug } = useParams<{ boardSlug: string }>()
  const [board, setBoard] = useState<any>(null)
  const [threads, setThreads] = useState<any[]>([])
  const [filteredThreads, setFilteredThreads] = useState<any[]>([])
  const [replyCountMap, setReplyCountMap] = useState<{ [threadId: string]: number }>({})
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'catalog'>('catalog')
  const [selectedPosters, setSelectedPosters] = useState<string[] | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'bump' | 'new' | 'replies' | 'pow'>('bump')
  
  // Real-time listener for PoW updates
  useRealtimeListener(
    'global-stats-updates',
    (message: any) => {
      if (message.type === 'stats-updated') {
        const { targetType, targetId, pointsAdded } = message.data || message.payload || message

        if (targetType === 'thread') {
          // Update thread in list and re-sort by totalPow
          setThreads((prevThreads) => {
            const updated = prevThreads.map((thread) => 
              thread.id === targetId 
                ? { ...thread, totalPow: (thread.totalPow || 0) + pointsAdded }
                : thread
            )
            // Re-sort by totalPow descending
            return updated.sort((a, b) => (b.totalPow || 0) - (a.totalPow || 0))
          })
        } else if (targetType === 'board' && targetId === board?.id) {
           // Update board total
           setBoard((prev: any) => ({
             ...prev,
             totalPow: (prev.totalPow || 0) + pointsAdded
           }))
        }
      }
    },
    [board?.id]
  )
  
  // Mining setup for board header
  const { useAttachTo } = useMouseoverMining('board', board?.id || '')
  const { mouseoverSession } = useMining()
  const headerRef = useRef<HTMLDivElement>(null)
  const isMining = mouseoverSession?.targetId === board?.id

  useEffect(() => {
    if (headerRef.current && board?.id) {
      return useAttachTo(headerRef.current)
    }
  }, [useAttachTo, board])

  useEffect(() => {
    loadData()
    
    // Set up realtime subscription for live updates
    let channel: any = null
    
    const initRealtime = async () => {
      try {
        channel = db.realtime.channel(`board-${boardSlug}`)
        await channel.subscribe()
        
        channel.onMessage((message) => {
          if (message.type === 'thread_updated' || message.type === 'pow_completed') {
            // Silently refresh threads in background
            loadData()
          } else if (message.type === 'post_created') {
            // Update reply count for specific thread
            const threadId = message.data?.threadId
            if (threadId) {
              setThreads(prev => prev.map(t => 
                t.id === threadId 
                  ? { ...t, replyCount: (t.replyCount || 0) + 1 }
                  : t
              ))
            }
          }
        })
      } catch (error) {
        console.error('Realtime subscription failed:', error)
      }
    }
    
    initRealtime()
    
    return () => {
      if (channel) {
        channel.unsubscribe()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardSlug])

  // Filter threads by selected posters AND search query
  useEffect(() => {
    let result = threads

    // Filter by posters
    if (selectedPosters && selectedPosters.length > 0) {
      result = result.filter(thread => selectedPosters.includes(thread.userId))
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(thread => 
        (thread.title && thread.title.toLowerCase().includes(q)) ||
        (thread.content && thread.content.toLowerCase().includes(q)) ||
        (thread.username && thread.username.toLowerCase().includes(q))
      )
    }

    // Apply Sorting
    result = [...result].sort((a, b) => {
       switch (sortBy) {
         case 'new': // Newest Creation First
           return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
         case 'replies': // Most Replies First
           return (b.replyCount || 0) - (a.replyCount || 0)
         case 'pow': // Highest PoW First
           return (b.totalPow || 0) - (a.totalPow || 0)
         case 'bump': // Bump Order (PoW tiers + Date)
         default:
           // Primary: sort by totalPow descending
           const powDiff = (b.totalPow || 0) - (a.totalPow || 0)
           if (powDiff !== 0) return powDiff
           
           // Secondary: sort by bumpOrder or createdAt
           // Assuming loadData already handled the initial correct sort, 
           // but we re-sort here to be safe if other sorts were applied
           return new Date(b.last_post_at || b.updatedAt || b.createdAt).getTime() - 
                  new Date(a.last_post_at || a.updatedAt || a.createdAt).getTime()
       }
    })

    setFilteredThreads(result)
  }, [threads, selectedPosters, searchQuery, sortBy])

  const loadData = async () => {
    try {
      // Load board
      const boards = await db.db.boards.list({
        where: { slug: boardSlug }
      })
      
      if (boards.length > 0) {
        setBoard(boards[0])

        // Load threads sorted by PoW (descending), then by timestamp (newest first)
        // This implements proper "bumping" - threads with more PoW stay on top, 
        // but within same PoW tier, newer threads are shown first
        const boardThreads = await db.db.threads.list({
          where: { 
            boardId: boards[0].id,
            expired: '0'
          },
          orderBy: { totalPow: 'desc' }
        })
        
        // Secondary sort: within same PoW tier, order by timestamp (bumpOrder desc = newer first)
        // This ensures threads "bump" down the list as they age without new PoW
        const sortedThreads = boardThreads.sort((a, b) => {
          // Primary: sort by totalPow descending
          const powDiff = (b.totalPow || 0) - (a.totalPow || 0)
          if (powDiff !== 0) return powDiff
          
          // Secondary: sort by bumpOrder descending (newer threads first)
          const bumpDiff = (b.bumpOrder || 0) - (a.bumpOrder || 0)
          return bumpDiff
        })
        setThreads(sortedThreads)

        // Reply counts are now part of the thread object (replyCount), no need to fetch posts!
      }
    } catch (error: any) {
      console.error('Failed to load data:', error)
      // Show a user-friendly message for rate limit errors
      if (error?.status === 429) {
        console.warn('Rate limit exceeded - data will refresh shortly')
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-background text-foreground min-h-screen flex items-center justify-center">
        <div className="text-center font-mono">
          <div className="text-2xl mb-2">LOADING...</div>
          <div className="text-muted-foreground">Fetching threads</div>
        </div>
      </div>
    )
  }

  if (!board) {
    return (
      <div className="bg-background text-foreground min-h-screen flex items-center justify-center">
        <div className="text-center font-mono">
          <div className="text-2xl mb-2">404</div>
          <div className="text-muted-foreground">Board not found</div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="container mx-auto p-4 max-w-6xl">
        {/* Board header and controls */}
        <div 
          ref={headerRef}
          className="border-2 border-gunmetal bg-gunmetal text-white p-4 mb-6 relative cursor-crosshair hover:bg-gunmetal/80 transition-colors"
        >
          {isMining && (
            <div className="absolute top-2 right-2">
              <MiningProgressBadge show={true} />
            </div>
          )}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold font-mono mb-2">/{board.slug}/</h1>
                <span className="text-xs bg-white/10 px-2 py-1 rounded text-white/70">
                  Hover to mine
                </span>
              </div>
              <p className="text-sm font-mono opacity-90">{board.description}</p>
              <div className="flex items-center gap-4 mt-2 text-xs opacity-70">
                <span>{threads.length} threads</span>
                <span>•</span>
                <span>{board.totalPow || 0} total POW</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="border border-celadon flex">
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-2 font-mono text-sm font-bold transition-colors ${
                    viewMode === 'list' ? 'bg-celadon text-gunmetal' : 'hover:bg-celadon/50'
                  }`}
                >
                  <LayoutList className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('catalog')}
                  className={`px-3 py-2 font-mono text-sm font-bold border-l border-celadon transition-colors ${
                    viewMode === 'catalog' ? 'bg-celadon text-gunmetal' : 'hover:bg-celadon/50'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
              <Link 
                to={`/board/${board.slug}/new`}
                className="border border-celadon px-6 py-2 font-mono text-sm font-bold hover:bg-celadon hover:text-gunmetal transition-colors"
              >
                [+ NEW THREAD]
              </Link>
            </div>
          </div>
        </div>

        {/* Search and Sort Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4 items-center bg-celadon/10 p-2 border border-gunmetal/20">
           <div className="relative flex-1 w-full">
             <Search className="absolute left-2 top-2.5 h-4 w-4 text-gunmetal/50" />
             <Input 
               placeholder="Search threads..." 
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="pl-8 font-mono bg-white border-gunmetal"
             />
           </div>
           
           <div className="flex items-center gap-2 w-full sm:w-auto">
             <span className="font-mono text-xs font-bold whitespace-nowrap">SORT BY:</span>
             <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
               <SelectTrigger className="w-full sm:w-[180px] font-mono bg-white border-gunmetal h-10">
                 <SelectValue placeholder="Sort Order" />
               </SelectTrigger>
               <SelectContent className="font-mono">
                 <SelectItem value="bump">Bump Order</SelectItem>
                 <SelectItem value="new">Creation Date</SelectItem>
                 <SelectItem value="replies">Most Replies</SelectItem>
                 <SelectItem value="pow">Total PoW</SelectItem>
               </SelectContent>
             </Select>
           </div>
        </div>

        {/* Poster Filter */}
        <PostersFilter onFilterChange={setSelectedPosters} />

        {/* Thread Display - Enhanced */}
        {viewMode === 'list' ? (
          <div className="border border-gunmetal">
            <div className="border-b border-gunmetal bg-deep-teal text-white px-4 py-2 font-mono text-base font-bold">
              THREADS {selectedPosters && selectedPosters.length > 0 && `(${filteredThreads.length} of ${threads.length})`}
            </div>
            
            <div className="overflow-x-auto bg-white">
              <table className="w-full font-mono text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gunmetal bg-celadon/30">
                    <th className="text-left py-3 px-4 font-bold">TITLE</th>
                    <th className="text-center py-3 px-4 font-bold">POSTER</th>
                    <th className="text-center py-3 px-4 font-bold">REPLIES</th>
                    <th className="text-center py-3 px-4 font-bold">POW</th>
                    <th className="text-center py-3 px-4 font-bold">DATE</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredThreads.map((thread) => (
                    <ThreadRow key={thread.id} thread={thread} boardSlug={board.slug} replyCount={thread.replyCount || 0} />
                  ))}
                  {filteredThreads.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-deep-teal">
                        {selectedPosters && selectedPosters.length > 0
                          ? 'No threads from selected posters.'
                          : 'No threads yet. Create the first thread.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <BoardCatalog threads={filteredThreads} boardSlug={board.slug} />
        )}

        {/* Info Box */}
        <div className="mt-4 border border-gunmetal p-3 font-mono text-xs bg-celadon/20">
          <p className="mb-1">
            <span className="font-bold">Note:</span> Threads are ranked by total proof-of-work.
          </p>
          <p>Mouseover any thread to begin mining PoW for it.</p>
        </div>
      </div>
    </div>
  )
}
