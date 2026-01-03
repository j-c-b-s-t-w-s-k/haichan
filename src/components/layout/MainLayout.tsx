/**
 * MainLayout - Refactored with proper auth context integration
 * Replaces all manual onAuthStateChanged subscriptions with useAuth hook
 */
import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '../ui/button'
import { BottomToolbar } from './BottomToolbar'
import { BoardsToolbar } from './BoardsToolbar'
import { BadgesInline } from '../../lib/badge-utils'
import { Layers, BookOpen, Pickaxe, User, LogOut, Trophy, Ticket, MessageSquare, Image, Settings, Shield, Users, Zap, Menu, X, Scroll, ChevronDown, Palette, Bell, Hash, Home, Sparkles } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'
import { POW_ESTIMATED_TIME } from '../../lib/constants'
import { formatBrandName } from '../../lib/utils'
import { MiningManager } from '../../lib/mining/MiningManager'
import db from '../../lib/db-client'

export function MainLayout() {
  const { authState, dbUser, signOut } = useAuth()
  const [username, setUsername] = useState<string>('')
  const [blogName, setBlogName] = useState<string>('')
  const [notificationCount, setNotificationCount] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const keydownListenerRef = useRef<((e: KeyboardEvent) => void) | null>(null)
  const navigate = useNavigate()

  const isAuthenticated = authState.isAuthenticated
  const user = authState.user

  // Keyboard shortcut for mining (M key) - only for authenticated users
  // Use ref to maintain stable handler reference across renders
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only trigger if not in input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      if ((e.key === 'M' || e.key === 'm') && authState.user) {
        e.preventDefault()
        const manager = MiningManager.getInstance()
        const dedicatedSession = manager.getSession('dedicated')

        if (dedicatedSession) {
          // Stop dedicated mining
          manager.stopDedicatedMining()
          toast.success('Dedicated mining stopped')
        } else {
          // Start dedicated mining
          manager.startDedicatedMining('user', undefined, 15, '21e8')
          toast.success('Dedicated mining started! Press M to stop.')
        }
      }
    }

    // Store handler reference for cleanup
    keydownListenerRef.current = handleKeyPress

    window.addEventListener('keydown', handleKeyPress)
    return () => {
      window.removeEventListener('keydown', handleKeyPress)
      keydownListenerRef.current = null
    }
  }, [authState.user])

  // Load user data when authenticated
  useEffect(() => {
    if (authState.user?.id) {
      loadUserData(authState.user.id)
      loadNotifications(authState.user.id)
    } else {
      setUsername('')
      setBlogName('')
      setNotificationCount(0)
    }
  }, [authState.user?.id]) // Only depend on user ID

  const loadUserData = async (userId: string) => {
    try {
      // Import request cache
      const { requestCache } = await import('../../lib/request-cache')

      // Try cache first with 30s TTL
      const userRecords = await requestCache.getOrFetch(
        `user-full-${userId}`,
        () => db.db.users.list({
          where: { id: userId }
        }),
        30000
      )
      
      if (userRecords && userRecords.length > 0) {
        const fullUser = userRecords[0]
        // dbUser comes from useAuth hook, update local username state
        setUsername(fullUser.username || fullUser.displayName || 'user')
        
        // Load user's blog name from cache or database
        const userBlogs = await requestCache.getOrFetch(
          `user-blog-${userId}`,
          () => db.db.blogPosts.list({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            limit: 1
          }),
          30000
        )
        
        if (userBlogs && userBlogs.length > 0 && userBlogs[0].blogName) {
          setBlogName(userBlogs[0].blogName)
        }
      }
    } catch (error) {
      console.error('Failed to load user data:', error)
    }
  }

  const loadNotifications = async (userId: string) => {
    try {
      const count = await db.db.notifications.count({
        where: { user_id: userId, is_read: 0 }
      })
      setNotificationCount(count)
    } catch (e) {
      console.error('Failed to load notifications', e)
    }
  }

  const handleLogout = useCallback(async () => {
    try {
      await signOut()
      toast.success('Logged out')
      navigate('/auth')
    } catch (error) {
      toast.error('Logout failed')
    }
  }, [signOut, navigate])

  // Allow rendering without user (loading is handled by MainLayout wrapper)
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header - 4chan style */}
      <header className="border-b border-foreground bg-card sticky top-0 z-50">
        <div className="container mx-auto px-3 py-1">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-outline-header text-2xl hover:opacity-80 transition-opacity">
              haichan
            </Link>

            <nav className="hidden md:flex items-center gap-0.5 text-xs flex-wrap justify-center max-w-3xl">
              <Link to="/" className="nav-link">[Home]</Link>
              <Link to="/thesis" className="nav-link">[Thesis]</Link>
              
              {/* Boards dropdown */}
              <BoardsToolbar />
              
              {/* Blogs dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger className="nav-link inline-flex items-center gap-0.5">
                  [Blogs<ChevronDown className="w-2.5 h-2.5" />]
                </DropdownMenuTrigger>
                <DropdownMenuContent className="font-mono text-xs">
                  <DropdownMenuItem asChild>
                    <Link to="/blogs" className="cursor-pointer">All Blogs</Link>
                  </DropdownMenuItem>
                  {authState.user && username && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to={`/blog/user/${username}`} className="cursor-pointer font-bold">
                          {blogName || 'My Blog'}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/blogs/new" className="cursor-pointer">New Post</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/blog/customize" className="cursor-pointer">Customize</Link>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              
              {user && (
                <Link to="/notifications" className="nav-link relative">
                   [Notifications]
                   {notificationCount > 0 && (
                     <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] px-1 rounded-full font-bold animate-pulse">
                       {notificationCount}
                     </span>
                   )}
                </Link>
              )}
              {user && <Link to="/mine" className="nav-link">[Mine]</Link>}
              <Link to="/canvas" className="nav-link">[Canvas]</Link>
              
              <DropdownMenu>
                <DropdownMenuTrigger className="nav-link inline-flex items-center gap-0.5">
                  [Games<ChevronDown className="w-2.5 h-2.5" />]
                </DropdownMenuTrigger>
                <DropdownMenuContent className="font-mono text-xs">
                  <DropdownMenuItem asChild>
                    <Link to="/games" className="cursor-pointer flex items-center">
                      <Zap className="w-3 h-3 mr-2" />
                      All Games
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/games?game=hashle" className="cursor-pointer flex items-center">
                      <Hash className="w-3 h-3 mr-2" />
                      Hashle
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/games?game=traphouse" className="cursor-pointer flex items-center">
                      <Home className="w-3 h-3 mr-2" />
                      Trap House 3D
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <a href="https://nebulune.studio/" target="_blank" rel="noopener noreferrer" className="cursor-pointer flex items-center">
                      <Sparkles className="w-3 h-3 mr-2" />
                      Nebulune.studio
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              {/* Chat dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger className="nav-link inline-flex items-center gap-0.5">
                  [Chat<ChevronDown className="w-2.5 h-2.5" />]
                </DropdownMenuTrigger>
                <DropdownMenuContent className="font-mono text-xs">
                  <DropdownMenuItem asChild>
                    <Link to="/chat" className="cursor-pointer">#general</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/rooms" className="cursor-pointer">Rooms</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled className="text-muted-foreground">
                    NameServ (21e80000)
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled className="text-muted-foreground">
                    BotServ (21e8000)
                  </DropdownMenuItem>
                  {(user?.username === 'jcb' || Number(user?.isAdmin) > 0) && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to="/chat?room=admin" className="cursor-pointer font-bold">#admin</Link>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              
              <DropdownMenu>
                <DropdownMenuTrigger className="nav-link inline-flex items-center gap-0.5">
                  [Images<ChevronDown className="w-2.5 h-2.5" />]
                </DropdownMenuTrigger>
                <DropdownMenuContent className="font-mono text-xs">
                  <DropdownMenuItem asChild>
                    <Link to="/images" className="cursor-pointer">Library</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/images/last-used" className="cursor-pointer">Last Used</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {user && <Link to="/settings" className="nav-link">[Settings]</Link>}
              {(user?.username === 'jcb' || Number(user?.isAdmin) > 0) && (
                <Link to="/admin" className="nav-link font-bold">[Admin]</Link>
              )}
            </nav>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 hover:bg-primary transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="flex items-center gap-2 text-xs">
              
              {user ? (
                <>
                  <div className="hidden md:flex items-center gap-1">
                    <span className="font-bold">{dbUser?.totalPowPoints || 0}</span>
                    <span className="text-muted-foreground">pts</span>
                  </div>
                  
                  <Link to="/profile" className="nav-link">
                    {formatBrandName(dbUser?.username || dbUser?.displayName || 'user')}
                    <BadgesInline user={dbUser} className="ml-0.5" />
                  </Link>

                  <button onClick={handleLogout} className="nav-link">
                    [logout]
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="nav-link font-bold">
                    [login]
                  </Link>
                  <Link to="/register" className="nav-link font-bold hidden sm:inline">
                    [register]
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-foreground bg-card">
            <nav className="container mx-auto px-2 py-2 flex flex-col gap-1">
              <Link to="/" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" size="sm" className="font-mono w-full justify-start">
                  <Layers className="w-4 h-4 mr-2" />
                  boards
                </Button>
              </Link>
              <Link to="/thesis" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" size="sm" className="font-mono w-full justify-start">
                  <Scroll className="w-4 h-4 mr-2" />
                  thesis
                </Button>
              </Link>
              <Link to="/blogs" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" size="sm" className="font-mono w-full justify-start">
                  <BookOpen className="w-4 h-4 mr-2" />
                  blogs
                </Button>
              </Link>
              {user && username && (
                <Link to={`/blog/user/${username}`} onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" size="sm" className="font-mono w-full justify-start">
                    <BookOpen className="w-4 h-4 mr-2" />
                    my blog
                  </Button>
                </Link>
              )}
              {user && (
                <Link to="/mine" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" size="sm" className="font-mono w-full justify-start">
                    <Pickaxe className="w-4 h-4 mr-2" />
                    mine
                  </Button>
                </Link>
              )}
              <Link to="/canvas" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" size="sm" className="font-mono w-full justify-start">
                  <Palette className="w-4 h-4 mr-2" />
                  canvas
                </Button>
              </Link>
              <Link to="/games" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" size="sm" className="font-mono w-full justify-start">
                  <Zap className="w-4 h-4 mr-2" />
                  games
                </Button>
              </Link>
              <Link to="/chat" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" size="sm" className="font-mono w-full justify-start">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  chat
                </Button>
              </Link>
              <Link to="/rooms" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" size="sm" className="font-mono w-full justify-start">
                  <Users className="w-4 h-4 mr-2" />
                  rooms
                </Button>
              </Link>
              <Link to="/images" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" size="sm" className="font-mono w-full justify-start">
                  <Image className="w-4 h-4 mr-2" />
                  images
                </Button>
              </Link>
              {user && (
                <Link to="/settings" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" size="sm" className="font-mono w-full justify-start">
                    <Settings className="w-4 h-4 mr-2" />
                    settings
                  </Button>
                </Link>
              )}
              {(user?.username === 'jcb' || Number(user?.isAdmin) > 0) && (
                <Link to="/admin" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" size="sm" className="font-mono w-full justify-start border-2 border-foreground bg-secondary font-bold">
                    <Shield className="w-4 h-4 mr-2" />
                    admin panel
                  </Button>
                </Link>
              )}
              <div className="border-t border-foreground mt-2 pt-2">
                {user ? (
                  <div className="flex items-center justify-between px-2 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4" />
                      <span className="font-bold">{dbUser?.totalPowPoints || 0} pts</span>
                    </div>
                  </div>
                ) : (
                  <div className="px-2 py-2 flex flex-col gap-2">
                     <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="outline" size="sm" className="w-full">
                        Login
                      </Button>
                    </Link>
                    <Link to="/register" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="default" size="sm" className="w-full">
                        Register
                      </Button>
                    </Link>
                  </div>
                )}
                {user ? (
                  <div className="px-2 pb-2 text-xs text-muted-foreground font-mono">
                    💡 Press <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-foreground font-bold">M</kbd> to toggle dedicated mining
                  </div>
                ) : (
                  <div className="px-2 pb-2 text-xs text-muted-foreground font-mono">
                    Log in to start mining!
                  </div>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="pb-12">
        <Outlet />
      </main>

      {/* Bottom Toolbar with PoW status */}
      <BottomToolbar />
    </div>
  )
}

export default MainLayout