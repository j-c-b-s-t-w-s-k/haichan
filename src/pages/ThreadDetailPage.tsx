import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, Trash2, MoreVertical, Shield, Zap, Loader2 } from 'lucide-react'
import { useMouseoverMining, useMining } from '../hooks/use-mining'
import { useRealtimeListener } from '../hooks/use-realtime-subscription'
import { isThreadLocked } from '../lib/pow-config'
import { MiningProgressBadge } from '../components/ui/mining-progress-badge'
import { Button } from '../components/ui/button'
import { MiningButton } from '../components/mining/MiningButton'
import { CircularOrbImage } from '../components/ui/circular-orb-image'
import { BadgesInline } from '../lib/badge-utils'
import { processRichText } from '../lib/rich-text'
import { QuickReplyForm } from '../components/views/QuickReplyForm'
import { PostPreview } from '../components/views/PostPreview'
import db from '../lib/db-client'
import { useAuth } from '../contexts/AuthContext'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu"
import toast from 'react-hot-toast'

export function ThreadDetailPage() {
  const { boardSlug, threadId } = useParams<{ boardSlug: string; threadId: string }>()
  const navigate = useNavigate()
  const { authState } = useAuth()
  const { useAttachTo: useAttachToBoardLink } = useMouseoverMining('board', boardSlug || '')
  const { useAttachTo: useAttachToThreadLink } = useMouseoverMining('thread', threadId || '')
  const boardLinkRef = useRef<HTMLAnchorElement>(null)
  const threadLinkRef = useRef<HTMLAnchorElement>(null)
  const { mouseoverSession, dedicatedSession, startDedicatedMining, stopDedicatedMining } = useMining()
  
  // Check if thread is currently being mined
  const isThreadMining = mouseoverSession?.targetId === threadId && mouseoverSession?.targetType === 'thread'
  
  const handleToggleMining = async (e: React.MouseEvent, targetType: 'thread' | 'post', targetId: string) => {
    e.preventDefault()
    e.stopPropagation()
    
    const isMiningThis = dedicatedSession?.targetType === targetType && dedicatedSession?.targetId === targetId
    
    if (isMiningThis) {
      stopDedicatedMining()
    } else {
      await startDedicatedMining(targetType, targetId, 1000000)
    }
  }

  const getEffectivePow = (basePow: number, id: string, type: 'thread' | 'post') => {
    if (dedicatedSession?.targetType === type && dedicatedSession?.targetId === id) {
      return basePow + (dedicatedSession.pendingPoints || 0)
    }
    return basePow
  }

  const [thread, setThread] = useState<any>(null)
  const [board, setBoard] = useState<any>(null)
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [showQuickReply, setShowQuickReply] = useState(false)
  const [replyTo, setReplyTo] = useState<string | undefined>(undefined)
  const [previewPost, setPreviewPost] = useState<any>(null)
  const [previewPos, setPreviewPos] = useState({ x: 0, y: 0 })

  // Handle post number click to open QR
  const handlePostNumberClick = (postNumber: string | number) => {
    setShowQuickReply(true)
    setReplyTo(postNumber.toString())
  }

  // Handle hover on quotelinks
  const handleMouseOver = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.classList.contains('quotelink')) {
      const postId = target.getAttribute('data-post-id')
      if (postId) {
        // Try to find by post number first (since quotes use post numbers usually)
        // Wait, rich-text regex captures digits. Are they IDs or Numbers?
        // 4chan uses Post Numbers (Integers). Our DB has UUIDs but also post_number.
        // Users type >>123 (Post Number).
        // So we need to find the post with that postNumber.
        
        const post = posts.find(p => String(p.post_number || p.postNumber) === postId) ||
                     (String(thread.post_number || thread.postNumber) === postId ? thread : null)
        
        if (post) {
          const rect = target.getBoundingClientRect()
          setPreviewPos({ x: rect.right, y: rect.top })
          setPreviewPost(post)
        }
      }
    }
  }

  const handleMouseOut = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.classList.contains('quotelink')) {
      setPreviewPost(null)
    }
  }

  // Real-time listener for PoW updates
  useRealtimeListener(
    `board-${boardSlug}`,
    (message: any) => {
      const { targetType, targetId, points } = message.payload || message
      
      // Update Thread PoW
      if (targetType === 'thread' && targetId === thread?.id) {
        setThread((prev: any) => ({
          ...prev,
          totalPow: (prev.totalPow || 0) + points
        }))
      }

      // Update Post PoW
      if (targetType === 'post') {
        setPosts((prevPosts) => 
          prevPosts.map((post) => 
            post.id === targetId 
              ? { ...post, totalPow: (post.totalPow || 0) + points }
              : post
          )
        )
      }
    },
    ['pow_completed'], // Filter for pow_completed events
    !!boardSlug
  )

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, boardSlug])
  
  // Calculate lock status whenever thread/posts change
  useEffect(() => {
    if (thread && posts.length > 0) {
      setIsLocked(isThreadLocked(posts.length, thread.totalPow || 0))
    }
  }, [thread, posts])

  useEffect(() => {
    if (boardLinkRef.current) {
      const cleanup = useAttachToBoardLink(boardLinkRef.current)
      return cleanup
    }
  }, [useAttachToBoardLink])

  useEffect(() => {
    if (threadLinkRef.current) {
      const cleanup = useAttachToThreadLink(threadLinkRef.current)
      return cleanup
    }
  }, [useAttachToThreadLink])

  const loadData = async () => {
    try {
      setLoading(true)

      // Load board info
      const boards = await db.db.boards.list({
        where: { slug: boardSlug }
      })
      if (boards.length > 0) {
        setBoard(boards[0])
      }

      // Load thread
      if (threadId) {
        const threads = await db.db.threads.list({
          where: { id: threadId }
        })
        if (threads.length > 0) {
          const loadedThread = threads[0]
          console.log('Thread from SDK:', loadedThread)
          console.log('Thread post number fields:', {
            postNumber: loadedThread.postNumber,
            post_number: loadedThread.post_number
          })
          setThread(loadedThread)

          // Load posts for this thread
          const threadPosts = await db.db.posts.list({
            where: { threadId: threadId },
            orderBy: { createdAt: 'asc' }
          })
          
          // Debug logging to see what SDK returns
          if (threadPosts.length > 0) {
            console.log('First post from SDK:', threadPosts[0])
            console.log('Post number fields:', {
              postNumber: threadPosts[0].postNumber,
              post_number: threadPosts[0].post_number
            })
          }
          
          setPosts(threadPosts)
        }
      }
    } catch (error) {
      console.error('Failed to load thread:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteThread = async (reason?: string) => {
    if (!thread || !threadId) return
    
    try {
      setIsDeleting(true)
      const toastId = toast.loading('Processing...')

      if (reason) {
        // Mod deletion - replace content
        await db.db.threads.update(threadId, {
          content: `[deleted: ${reason}]`,
          title: `[deleted: ${reason}]`,
          imageUrl: null,
          totalPow: 0 // Reset PoW? Or keep it? "too cheap" implies low PoW anyway.
        })
         toast.dismiss(toastId)
         toast.success('Thread pruned')
         // Don't navigate away, just reload
         loadData()
      } else {
        // Full delete
        await db.db.posts.deleteMany({
          where: { threadId }
        })
        await db.db.threads.delete(threadId)
        toast.dismiss(toastId)
        toast.success('Thread deleted')
        navigate(`/board/${boardSlug}`)
      }
    } catch (error) {
      console.error('Failed to delete thread:', error)
      toast.error('Failed to delete thread')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleModPost = async (postId: string, reason: string) => {
    try {
      const toastId = toast.loading('Pruning post...')
      await db.db.posts.update(postId, {
        content: `[deleted: ${reason}]`,
        imageUrl: null
      })
      toast.dismiss(toastId)
      toast.success('Post pruned')
      // Update local state
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, content: `[deleted: ${reason}]`, imageUrl: null } : p))
    } catch (error) {
      toast.error('Failed to prune post')
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatHashAge = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const blocks = Math.floor(diff / (10 * 60 * 1000)) // 10 minute blocks
    return `${blocks} BLOCKS`
  }

  const canDelete = authState.user && (
    authState.user.id === thread?.userId || 
    authState.user.is_admin || 
    authState.user.isAdmin
  )
  
  const isAdmin = authState.user?.is_admin || authState.user?.isAdmin

  if (loading) {
    return (
      <div className="bg-celadon text-gunmetal min-h-screen flex items-center justify-center">
        <div className="text-center font-mono">
          <div className="text-2xl mb-2">LOADING...</div>
          <div className="text-deep-teal">Fetching thread</div>
        </div>
      </div>
    )
  }

  if (!thread || !board) {
    return (
      <div className="bg-celadon text-gunmetal min-h-screen flex items-center justify-center">
        <div className="text-center font-mono">
          <div className="text-2xl mb-2">404</div>
          <div className="text-deep-teal mb-4">Thread not found</div>
          <Button
            onClick={() => navigate(-1)}
            className="border-2 border-gunmetal px-4 py-2 font-mono font-bold hover:bg-gunmetal hover:text-celadon"
          >
            ← BACK
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="bg-celadon text-gunmetal min-h-screen"
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
    >
      <div className="container mx-auto p-4 max-w-4xl">
        {/* Breadcrumb Navigation */}
        <div className="mb-2 font-mono text-xs flex items-center gap-2">
          <Link
            ref={boardLinkRef}
            to={`/board/${boardSlug}`}
            className="hover:underline font-bold text-emerald"
          >
            /{boardSlug}/
          </Link>
          <span className="opacity-50">&gt;</span>
          <span className="opacity-70">{thread.title}</span>
          <Link
            ref={threadLinkRef}
            to={`/board/${boardSlug}`}
            className="ml-auto flex items-center gap-1 text-emerald hover:underline text-xs"
          >
            <ChevronLeft className="w-3 h-3" />
            Back to board
          </Link>
        </div>

        {/* Thread OP Post - 4chan style */}
        <div className="border border-gunmetal mb-4">
          <div className="post-container bg-white">
            <div className="post-header relative">
              <span className="post-username flex items-center gap-0.5">
                {thread.username || 'Anonymous'}
                <BadgesInline user={thread} className="inline-flex" />
              </span>
              {thread.tripcode && (
                <span className="post-tripcode ml-1 font-bold text-emerald" title="Tripcode">
                  {thread.tripcode}
                </span>
              )}
              <span className="post-date ml-2">
                {formatDate(thread.createdAt)}
              </span>
              <span 
                className="post-number ml-2 cursor-pointer hover:underline"
                onClick={() => handlePostNumberClick(thread.post_number || thread.postNumber || '')}
              >
                No.{(() => {
                  const num = Number(thread.post_number || thread.postNumber || 0);
                  return Number.isFinite(num) && num >= 0 ? num : 'N/A';
                })()}
              </span>
              <span className="post-age ml-2 font-mono text-[10px] text-gray-500" title="Hash Age">
                [{formatHashAge(thread.createdAt)}]
              </span>
              
              {canDelete && (
                <div className="absolute top-0 right-0 p-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-gray-100">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="font-mono">
                      <DropdownMenuLabel>Thread Actions</DropdownMenuLabel>
                      {isAdmin && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDeleteThread('too cheap')}>
                            Flag: Too Cheap
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteThread('too loud')}>
                            Flag: Too Loud
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteThread('already said')}>
                            Flag: Already Said
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuItem onClick={() => handleDeleteThread()} className="text-red-600">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Permanently
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
            <div className="font-bold text-sm mb-1 text-tropical-mint flex items-center gap-2">
              {thread.title}
              {isThreadMining && <MiningProgressBadge show={true} />}
              {isLocked && (
                <span className="text-[10px] bg-red-100 text-red-600 border border-red-400 px-1 font-mono">
                  LOCKED
                </span>
              )}
            </div>
            {thread.imageUrl && (
              <div className="mb-2 relative group w-fit">
                <div className={getEffectivePow(thread.totalPow || 0, thread.id, 'thread') < 50 ? 'blur-sm transition-all duration-500' : ''}>
                  <CircularOrbImage
                    src={thread.imageUrl}
                    alt="OP"
                    size={256}
                    className="border border-gunmetal"
                  />
                </div>
                {getEffectivePow(thread.totalPow || 0, thread.id, 'thread') < 50 && (
                  <div 
                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 cursor-pointer z-10"
                    onClick={(e) => handleToggleMining(e, 'thread', thread.id)}
                  >
                    <div className={`
                      text-[10px] font-mono px-2 py-1 border flex items-center gap-1 transition-all duration-300
                      ${dedicatedSession?.targetId === thread.id 
                        ? "bg-amber-500 text-black border-amber-600 animate-pulse" 
                        : "bg-black text-white border-white hover:bg-black/80"}
                    `}>
                      {dedicatedSession?.targetId === thread.id ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          MINING...
                        </>
                      ) : (
                        <>
                          <Zap className="w-3 h-3" />
                          MINE TO SHARPEN
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="post-content whitespace-pre-wrap break-words">
              {processRichText(thread.content)}
            </div>
            <div className="flex gap-2 mt-2 text-xs text-deep-teal items-center">
              <span>POW: {getEffectivePow(thread.totalPow || 0, thread.id, 'thread')}</span>
              <MiningButton targetType="thread" targetId={thread.id} size="sm" className="h-6 px-2" />
              <span>•</span>
              <span>{posts.length} replies</span>
            </div>
          </div>
        </div>

        {/* Posts - 4chan style */}
        <div className="border border-gunmetal">
          <div className="border-b border-gunmetal bg-deep-teal px-2 py-1 font-mono text-xs font-bold text-white">
            💬 REPLIES ({posts.length})
          </div>

          <div className="bg-white">
            {posts.length === 0 ? (
              <div className="p-4 text-center text-deep-teal font-mono text-xs">
                No replies yet. Be the first to respond.
              </div>
            ) : (
              posts.map((post, index) => (
                <div key={post.id} id={`p${post.post_number || post.postNumber}`} className="post-container border-b border-celadon hover:bg-celadon/30">
                  <div className="post-header">
                    <span className="post-username flex items-center gap-0.5">
                      {post.username || 'Anonymous'}
                      <BadgesInline user={post} className="inline-flex" />
                    </span>
                    {post.tripcode && (
                      <span className="post-tripcode ml-1 font-bold text-emerald" title="Tripcode">
                        {post.tripcode}
                      </span>
                    )}
                    <span className="post-date ml-2">
                      {formatDate(post.createdAt)}
                    </span>
                    <span 
                      className="post-number ml-2 cursor-pointer hover:underline"
                      onClick={() => handlePostNumberClick(post.post_number || post.postNumber || '')}
                    >
                      No.{(() => {
                        const num = Number(post.post_number || post.postNumber || 0);
                        return Number.isFinite(num) && num >= 0 ? num : 'N/A';
                      })()}
                    </span>
                    <span className="post-age ml-2 font-mono text-[10px] text-gray-500" title="Hash Age">
                      [{formatHashAge(post.createdAt)}]
                    </span>
                    
                    {isAdmin && (
                      <div className="ml-auto">
                         <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-5 w-5 p-0 hover:bg-gray-100">
                              <Shield className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="font-mono text-xs">
                            <DropdownMenuItem onClick={() => handleModPost(post.id, 'too cheap')}>
                              Flag: Too Cheap
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleModPost(post.id, 'too loud')}>
                              Flag: Too Loud
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleModPost(post.id, 'already said')}>
                              Flag: Already Said
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={async () => {
                              if(confirm('Delete permanently?')) {
                                await db.db.posts.delete(post.id)
                                setPosts(prev => prev.filter(p => p.id !== post.id))
                              }
                            }} className="text-red-600">
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                  <div className="post-content whitespace-pre-wrap break-words">
                    {processRichText(post.content)}
                  </div>
                  {post.imageUrl && (
                    <div className="mt-2 relative group w-fit">
                      <div className={getEffectivePow(post.totalPow || 0, post.id, 'post') < 50 ? 'blur-sm transition-all duration-500' : ''}>
                        <CircularOrbImage
                          src={post.imageUrl}
                          alt="Post"
                          size={256}
                          className="border border-gunmetal"
                        />
                      </div>
                      {getEffectivePow(post.totalPow || 0, post.id, 'post') < 50 && (
                        <div 
                          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 cursor-pointer z-10"
                          onClick={(e) => handleToggleMining(e, 'post', post.id)}
                        >
                          <div className={`
                            text-[10px] font-mono px-2 py-1 border flex items-center gap-1 transition-all duration-300
                            ${dedicatedSession?.targetId === post.id 
                              ? "bg-amber-500 text-black border-amber-600 animate-pulse" 
                              : "bg-black text-white border-white hover:bg-black/80"}
                          `}>
                            {dedicatedSession?.targetId === post.id ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                MINING...
                              </>
                            ) : (
                              <>
                                <Zap className="w-3 h-3" />
                                MINE TO SHARPEN
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2 mt-2 items-center">
                    <button
                      onClick={() => navigate(`/board/${boardSlug}/thread/${threadId}/reply?replyTo=${post.id}`)}
                      className="text-xs text-emerald hover:underline"
                    >
                      Reply
                    </button>
                    <span className="text-xs text-deep-teal">
                      POW: {getEffectivePow(post.totalPow || 0, post.id, 'post')}
                    </span>
                    <MiningButton targetType="post" targetId={post.id} size="sm" variant="ghost" className="h-5 px-1 text-[10px]" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Reply & Previews */}
        {showQuickReply && (
          <QuickReplyForm 
            boardSlug={boardSlug || ''} 
            threadId={threadId || ''} 
            replyTo={replyTo}
            onClose={() => setShowQuickReply(false)}
            onSuccess={() => {
               loadData() // Refresh posts
               // Don't close, maybe just minimize or clear? 
               // 4chan keeps it open usually, but let's clear replyTo
               setReplyTo(undefined)
            }}
          />
        )}
        
        {/* Floating Toggle Button if QR is closed */}
        {!showQuickReply && (
           <div className="fixed bottom-4 right-4 z-40">
             <Button
               onClick={() => setShowQuickReply(true)}
               className="shadow-xl bg-deep-teal text-white font-mono rounded-full h-12 w-12 p-0 flex items-center justify-center border-2 border-gunmetal hover:scale-105 transition-transform"
             >
               <span className="text-xl font-bold">+</span>
             </Button>
           </div>
        )}

        {previewPost && (
          <PostPreview post={previewPost} position={previewPos} />
        )}

        {/* Reply Button */}
        <div className="mt-4 flex gap-2 items-center">
          {isLocked ? (
            <div className="border border-red-500 bg-red-50 px-4 py-2 font-mono text-xs text-red-600 font-bold flex-1 text-center">
              ⛔ THREAD LOCKED. MINE THREAD TO {posts.length * 1000} POW TO UNLOCK.
            </div>
          ) : (
            <Link
              to={`/board/${boardSlug}/thread/${threadId}/reply`}
              className="border border-gunmetal px-4 py-2 font-mono text-xs font-bold hover:bg-gunmetal hover:text-celadon bg-white"
            >
              [+ REPLY]
            </Link>
          )}
          <button
            onClick={() => loadData()}
            className="border border-gunmetal px-4 py-2 font-mono text-xs font-bold hover:bg-gunmetal hover:text-celadon bg-white"
          >
            [REFRESH]
          </button>
        </div>
      </div>
    </div>
  )
}