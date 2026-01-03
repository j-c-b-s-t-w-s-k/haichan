import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Zap, Database, Lock, Trophy, MessageSquare, BookOpen } from 'lucide-react'
import db from '../lib/db-client'
import { GlobalPoWStats } from '../components/views/GlobalPoWStats'
import { PostersList } from '../components/views/PostersList'
import { HashleLeaderboard } from '../components/views/HashleLeaderboard'
import { useAuth } from '../contexts/AuthContext'
import { requestCache } from '../lib/request-cache'
import { withRateLimit } from '../lib/rate-limit-utils'
import { subscribeToChannel } from '../lib/realtime-manager'

const MAX_USERS = 256

export function HomePage() {
  const { authState } = useAuth()
  const [boards, setBoards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [onlineUsers, setOnlineUsers] = useState<any[]>([])
  const [newestUser, setNewestUser] = useState<any>(null)
  const [totalUsers, setTotalUsers] = useState(0)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [showHowToStart, setShowHowToStart] = useState(false)

  useEffect(() => {
    // Load data on mount (auth is guaranteed by ProtectedRoute)
    const initializeData = async () => {
      try {
        // Load initial data
        await Promise.allSettled([
          loadBoards(),
          loadOnlineUsers(),
          loadNewestUser(),
          loadTotalUsers(),
          checkCurrentUser()
        ])
        
        setLoading(false)
        
        // Setup real-time subscriptions for instant updates
        setupRealtimeBoards()
        setupRealtimeUsers()
      } catch (error) {
        console.error('Failed to load page data:', error)
        setLoading(false)
      }
    }
    
    let unsubscribeBoards: (() => void) | null = null
    let unsubscribeUsers: (() => void) | null = null
    
    const setupRealtimeBoards = async () => {
      // Real-time is non-critical enhancement - errors are handled gracefully in realtime-manager
      unsubscribeBoards = await subscribeToChannel(
        'boards-updates',
        'homepage-boards',
        (message: any) => {
          if (message.type === 'board-created' || message.type === 'board-updated' || message.type === 'board-deleted') {
            // Invalidate cache and reload instantly
            requestCache.invalidate('homepage-boards')
            loadBoards()
          }
        }
      )
    }
    
    const setupRealtimeUsers = async () => {
      // Real-time is non-critical enhancement - errors are handled gracefully in realtime-manager
      unsubscribeUsers = await subscribeToChannel(
        'users-activity',
        'homepage-users',
        (message: any) => {
          if (message.type === 'user-activity') {
            // Invalidate cache and reload online users instantly
            requestCache.invalidate('homepage-online-users')
            loadOnlineUsers()
          }
          if (message.type === 'user-joined' || message.type === 'user-registered') {
            // Reload newest user and total count instantly
            requestCache.invalidatePattern(/homepage-(newest-user|total-users)/)
            loadNewestUser()
            loadTotalUsers()
          }
        }
      )
    }
    
    initializeData()
    
    return () => {
      unsubscribeBoards?.()
      unsubscribeUsers?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkCurrentUser = async () => {
    try {
      const authUser = authState.user
      
      if (authUser) {
        // Fetch full user data from database to get custom username field
        const fullUsers = await requestCache.getOrFetch(
          `homepage-current-user-${authUser.id}`,
          () => withRateLimit(() => db.db.users.list({
            where: { id: authUser.id },
            limit: 1
          }), { maxRetries: 5, initialDelayMs: 300 }),
          30000 // 30 second cache for current user data
        )
        
        const fullUser = fullUsers && fullUsers.length > 0 ? fullUsers[0] : authUser
        setCurrentUser(fullUser)
        
        // Parse metadata to check if user has seen the guide
        let metadata = {}
        try {
          metadata = fullUser.metadata ? JSON.parse(fullUser.metadata) : {}
        } catch (e) {
          console.error('Failed to parse user metadata:', e)
          metadata = {}
        }
        
        // Show guide only if user hasn't seen it before
        if (!metadata.hasSeenHowToStart) {
          setShowHowToStart(true)
          // Mark as seen
          await markHowToStartAsSeen(authUser.id, metadata)
        }
      }
    } catch (error) {
      // User not logged in, don't show the guide
      console.log('User not authenticated:', error)
    }
  }

  const markHowToStartAsSeen = async (userId: string, existingMetadata: any) => {
    try {
      const updatedMetadata = {
        ...existingMetadata,
        hasSeenHowToStart: true,
        firstVisitDate: new Date().toISOString()
      }
      
      await withRateLimit(() => db.db.users.update(userId, {
        metadata: JSON.stringify(updatedMetadata)
      }), { maxRetries: 3, initialDelayMs: 100 })
    } catch (error) {
      console.error('Failed to update user metadata:', error)
    }
  }

  const loadBoards = async () => {
    try {
      const allBoards = await requestCache.getOrFetch(
        'homepage-boards',
        () => withRateLimit(() => db.db.boards.list({
          orderBy: { totalPow: 'desc' },
          limit: 10
        }), { maxRetries: 5, initialDelayMs: 300 }),
        30000 // 30 second cache - real-time updates will invalidate when needed
      )
      setBoards(allBoards || [])
    } catch (error: any) {
      // Silently handle rate limit errors - keep existing data
      if (error?.status !== 429 && error?.code !== 'RATE_LIMIT_EXCEEDED') {
        console.error('Failed to load boards:', error)
      }
      // Keep existing boards on error instead of clearing
    }
  }

  const loadOnlineUsers = async () => {
    try {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()
      const active = await requestCache.getOrFetch(
        'homepage-online-users',
        () => withRateLimit(() => db.db.chatActivity.list({
          where: { lastActivity: { '>': twoMinutesAgo } },
          orderBy: { lastActivity: 'desc' },
          limit: 20
        }), { maxRetries: 5, initialDelayMs: 300 }),
        10000 // 10 second cache - balance between real-time and rate limit safety
      )
      setOnlineUsers(active || [])
    } catch (error: any) {
      // Silently handle rate limit errors - cache will retry automatically
      if (error?.status !== 429 && error?.code !== 'RATE_LIMIT_EXCEEDED') {
        console.error('Failed to load online users:', error)
      }
      // Keep existing data on error instead of clearing
    }
  }

  const loadNewestUser = async () => {
    try {
      // Fetch more users and sort client-side to ensure accuracy
      const users = await requestCache.getOrFetch(
        'homepage-newest-user',
        () => withRateLimit(() => db.db.users.list({
          orderBy: { createdAt: 'desc' },
          limit: 5
        }), { maxRetries: 5, initialDelayMs: 300 }),
        30000 // 30 second cache - user registration is infrequent, safe to cache longer
      )
      
      if (users && users.length > 0) {
        // Sort by createdAt descending to ensure newest is first
        const sorted = users.sort((a: any, b: any) => {
          const timeA = new Date(a.createdAt).getTime()
          const timeB = new Date(b.createdAt).getTime()
          return timeB - timeA // Newest first
        })
        
        const newest = sorted[0]
        console.log('Newest user loaded:', newest.username || newest.displayName, newest)
        setNewestUser(newest)
      } else {
        setNewestUser(null)
      }
    } catch (error: any) {
      // Silently handle rate limit errors
      if (error?.status !== 429 && error?.code !== 'RATE_LIMIT_EXCEEDED') {
        console.error('Failed to load newest user:', error)
      }
      // Keep existing data on error
    }
  }

  const loadTotalUsers = async () => {
    try {
      const users = await requestCache.getOrFetch(
        'homepage-total-users',
        () => withRateLimit(() => db.db.users.list({ limit: 1000 }), { maxRetries: 5, initialDelayMs: 300 }),
        60000 // 60 second cache - total user count changes very slowly
      )
      setTotalUsers(users ? users.length : 0)
    } catch (error: any) {
      // Silently handle rate limit errors
      if (error?.status !== 429 && error?.code !== 'RATE_LIMIT_EXCEEDED') {
        console.error('Failed to load total users:', error)
      }
      // Keep existing data on error
    }
  }

  // Show loading state while data loads (auth handled by ProtectedRoute)
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center font-mono">
          <div className="text-2xl mb-2">▓▓▓▓▓▓▓▓</div>
          <div className="text-sm">LOADING...</div>
        </div>
      </div>
    )
  }

  // Show the full imageboard dashboard
  return (
    <div className="bg-background text-foreground min-h-screen">
      {/* Hero Section - 4chan style */}
      <div className="border-b border-foreground bg-card">
        <div className="container mx-auto max-w-7xl py-1 px-3">
          <div className="text-center mb-1">
            <h1 className="text-outline-header mb-1" style={{fontSize: '32px'}}>haichan</h1>
            <p className="text-xs font-bold">a proof-of-work based imageboard</p>
            
          </div>
        </div>
      </div>

      {/* Main Content - 4chan style */}
      <div className="container mx-auto max-w-7xl p-3">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-2">
            {/* Welcome Info Box */}
            <div className="border border-foreground bg-card p-2">
              <h2 className="text-outline-shadow text-lg mb-1">What is haichan?</h2>
              <p className="text-xs mb-1">
                A proof-of-work based imageboard where every action requires computational work. 
                Content ranks by total PoW accumulated. Mine for points, find rare hashes, build your diamond reputation.
              </p>
              <p className="text-xs">
                Hover over content to mine SHA-256 hashes. Find a hash starting with 21e8 to submit valid proof. 
                No ads. No algorithm. Pure computational merit.
              </p>
            </div>

            {/* Features Grid */}
            <div className="border border-foreground">
              <div className="border-b border-foreground bg-muted px-2 py-1 font-bold text-xs">
                core features
              </div>
              <div className="p-2 space-y-1 text-xs">
                <div className="flex items-start gap-1">
                  <Zap size={14} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>Hover-to-mine:</strong> Mine SHA-256 hashes by hovering over content
                  </div>
                </div>
                <div className="flex items-start gap-1">
                  <Database size={14} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>PoW ranking:</strong> Content ranks by computational power, not algorithms
                  </div>
                </div>
                <div className="flex items-start gap-1">
                  <Trophy size={14} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>Diamond hash:</strong> 10 levels of achievement and reputation
                  </div>
                </div>
                <div className="flex items-start gap-1">
                  <Lock size={14} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>Invite only:</strong> Registration requires valid invite code
                  </div>
                </div>
                <div className="flex items-start gap-1">
                  <MessageSquare size={14} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>Live chat:</strong> Real-time global chat, mine while you discuss
                  </div>
                </div>
                <div className="flex items-start gap-1">
                  <BookOpen size={14} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>Blogs:</strong> Long-form content with mining integration
                  </div>
                </div>
                <div className="flex items-start gap-1">
                  <Zap size={14} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>Canvas:</strong> Collaborative AI-powered drawing with texture & GIF export
                  </div>
                </div>
              </div>
            </div>

            {/* How to Start - Only show to new registered users */}
            {showHowToStart && currentUser && (
              <div className="border border-foreground bg-primary/20">
                <div className="border-b border-foreground bg-muted px-2 py-1 font-bold text-xs">
                  how to start
                </div>
                <div className="p-2 text-xs space-y-0">
                  <div><span className="font-bold">1. register</span> — Create account with invite code</div>
                  <div><span className="font-bold">2. mine</span> — Hover over content, mine SHA-256, find 21e8 hashes</div>
                  <div><span className="font-bold">3. post</span> — Share images, threads, blogs after mining</div>
                  <div><span className="font-bold">4. climb</span> — Reach diamond levels, rank on leaderboard</div>
                </div>
              </div>
            )}

            {/* Boards List - 4chan style */}
            {!loading && (
              <div className="border border-foreground">
                <div className="border-b border-foreground bg-muted px-2 py-1 font-bold text-xs">
                  Boards
                </div>
                <div className="p-2">
                  {boards.length > 0 ? (
                    <div className="space-y-0">
                      {boards.map((board) => (
                        <div key={board.id} className="text-xs">
                          <Link
                            to={`/board/${board.slug}`}
                            className="font-bold hover:underline"
                          >
                            /{board.slug}/
                          </Link>
                          {' - '}
                          <span className="text-muted-foreground">{board.description}</span>
                          {' '}
                          <span className="text-[10px]">({board.totalPow || 0} PoW)</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-2 text-muted-foreground text-xs">No boards yet</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Stats */}
          <div className="space-y-2">
            {/* Site Statistics */}
            <div className="border border-foreground bg-card">
              <div className="border-b border-foreground bg-muted px-2 py-1 font-bold text-xs">
                Statistics
              </div>
              <div className="p-2 text-xs space-y-0">
                <div>Total users: <strong>{totalUsers}</strong></div>
                <div>Max capacity: <strong>{MAX_USERS}</strong></div>
                <div>Boards: <strong>{boards.length}</strong></div>
                <div>Online: <strong>{onlineUsers.length}</strong></div>
              </div>
            </div>

            {/* Online Users */}
            <div className="border border-foreground">
              <div className="border-b border-foreground bg-muted px-2 py-1 font-bold text-xs">
                Currently Active ({onlineUsers.length})
              </div>
              <div className="p-2">
                {onlineUsers.length > 0 ? (
                  <div className="space-y-0 text-xs">
                    {onlineUsers.slice(0, 10).map((user) => (
                      <div key={user.userId}>
                        • {user.username}
                      </div>
                    ))}
                    {onlineUsers.length > 10 && (
                      <div className="text-muted-foreground text-[10px] mt-0">
                        +{onlineUsers.length - 10} more
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-2 text-muted-foreground text-xs">
                    No users online
                  </div>
                )}
              </div>
            </div>

            {/* Newest/Current User */}
            {(currentUser || newestUser) && (
              <div className="border border-foreground bg-primary/10">
                <div className="border-b border-foreground bg-muted px-2 py-1 font-bold text-xs">
                  {currentUser ? 'Welcome Back' : 'Newest User'}
                </div>
                <div className="p-2 text-xs">
                  <div className="font-bold">
                    {currentUser 
                      ? (currentUser.username || 'Anonymous')
                      : (newestUser.username || newestUser.displayName || 'Anonymous')
                    }
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {currentUser 
                      ? `Joined ${new Date(currentUser.createdAt).toLocaleDateString()}`
                      : `Joined ${new Date(newestUser.createdAt).toLocaleDateString()}`
                    }
                  </div>
                </div>
              </div>
            )}

            {currentUser && (
              <>
                <GlobalPoWStats />
                <HashleLeaderboard />
                <PostersList />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
