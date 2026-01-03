import { useState, useEffect, useRef } from 'react'
import { Send, Users as UsersIcon, Bot, Plus, UserPlus } from 'lucide-react'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import db from '../../lib/db-client'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { debounce, AdaptivePoller } from '../../lib/performance-utils'
import { formatBrandName } from '../../lib/utils'
import { requestCache } from '../../lib/request-cache'
import { useAuth } from '../../contexts/AuthContext'

// Extracted ChatInput component to prevent re-renders of the main list
const ChatInput = ({ onSend, disabled }: { onSend: (msg: string) => void, disabled: boolean }) => {
  const [message, setMessage] = useState('')

  const handleSend = () => {
    if (message.trim()) {
      onSend(message)
      setMessage('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t-2 border-foreground p-2 flex gap-2">
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message or /help for commands..."
        className="flex-1 px-2 py-1 border border-foreground bg-background text-foreground font-mono text-xs focus:outline-none"
        autoComplete="off"
        disabled={disabled}
      />
      <Button onClick={handleSend} size="sm" className="font-mono flex-shrink-0" disabled={disabled}>
        <Send className="w-3 h-3" />
      </Button>
    </div>
  )
}

interface ChatMessage {
  id: string
  content: string
  userId: string
  username: string
  isBot: number
  createdAt: string
}

interface OnlineUser {
  userId: string
  username: string
  lastActivity: string
}

const INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 1 hour in milliseconds
const REALTIME_CHANNEL = 'global-chat'; // Single realtime channel for messages
const ACTIVITY_CHANNEL = 'chat-activity'; // Separate channel for activity
const ACTIVITY_HEARTBEAT_INTERVAL = 60000; // Send heartbeat every 60 seconds (reduced frequency)
const TALKY_CHECK_INTERVAL = 60000; // Check if Talky should speak every 60 seconds (reduced to avoid rate limits)
const MAX_USERS = 256; // Anti-scale user limit
const INITIAL_LOAD_LIMIT = 50; // Load fewer messages initially for speed
const CACHE_TTL = 15000; // 15 second cache for chat data (increased to reduce DB load)
const MESSAGE_REFRESH_INTERVAL = 60000; // Refresh messages every 60 seconds (reduced to avoid rate limits)

export function RealtimeChat() {
  const { authState } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  // removed newMessage state from here
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])
  const [user, setUser] = useState<any>(null)
  const [showCommandHelp, setShowCommandHelp] = useState(false)
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [displayAsAnonymous, setDisplayAsAnonymous] = useState(false)
  const [showProfileDialog, setShowProfileDialog] = useState(false)
  const [userProfile, setUserProfile] = useState<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastActivityRef = useRef<number>(Date.now())
  const usersPollerRef = useRef(new AdaptivePoller<OnlineUser[]>(2000, 15000))
  const navigate = useNavigate()

  // Load anonymous preference from localStorage
  useEffect(() => {
    const anonPref = localStorage.getItem('chat-anonymous')
    if (anonPref === 'true') {
      setDisplayAsAnonymous(true)
    }
  }, [])

  useEffect(() => {
    loadUser()
    initializeMemory()
    initializeChatStats()
  }, [])

  const initializeMemory = async () => {
    try {
      // Check if memory already initialized
      const memories = await db.db.chatMemory.list({ limit: 1 })
      if (memories && memories.length === 0) {
        // Seed initial memory with system info
        await db.db.chatMemory.create({
          id: `init-${Date.now()}`,
          memoryType: 'system',
          content: 'Talky AI mediator initialized. I help facilitate discussions, settle debates, and gather information. Mention @talky in your messages for mediation or fact-checking.',
          relevanceScore: 0.9,
          createdAt: new Date().toISOString(),
          accessedAt: new Date().toISOString(),
          expiresAt: null
        })
      }
    } catch (error) {
      console.error('Failed to initialize memory:', error)
    }
  }

  const initializeChatStats = async () => {
    try {
      // Check if stats record exists
      const stats = await db.db.chatStats.list({ limit: 1 })
      if (!stats || stats.length === 0) {
        // Create initial stats record
        await db.db.chatStats.create({
          id: 'singleton',
          totalUsers: 0,
          lastMessageAt: new Date().toISOString(),
          lastTalkyMessageAt: null
        })
      }
    } catch (error) {
      console.error('Failed to initialize chat stats:', error)
    }
  }

  useEffect(() => {
    if (!user?.id) return

    // Initialize: load initial messages and setup realtime
    loadMessages()
    loadOnlineUsers()
    updateActivity()

    // Subscribe to realtime chat messages - instant updates
    const unsubscribeChat = db.realtime.subscribe(REALTIME_CHANNEL, (message: any) => {
      if (message.type === 'message') {
        // Check if message already exists to prevent duplicates
        setMessages(prev => {
          const messageExists = prev.some(m => m.id === message.data.id)
          if (messageExists) {
            return prev // Don't add duplicate
          }
          return [...prev, message.data]
        })
        // Auto-scroll on new message
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 0)
      }
    }).catch(error => {
      console.error('Failed to subscribe to chat channel:', error)
      // Fallback to polling if realtime fails
      setInterval(() => loadMessages(100), 5000)
    })

    // Subscribe to activity updates - instant online user list
    const unsubscribeActivity = db.realtime.subscribe(ACTIVITY_CHANNEL, (message: any) => {
      if (message.type === 'activity-update') {
        loadOnlineUsers() // Quick refresh
      }
    }).catch(error => {
      console.error('Failed to subscribe to activity channel:', error)
    })

    // Lightweight heartbeat for activity (less frequent now)
    const activityHeartbeat = setInterval(updateActivity, ACTIVITY_HEARTBEAT_INTERVAL)
    
    // Check for inactivity timeout
    const inactivityCheck = setInterval(checkInactivity, 60000)
    
    // Check if Talky should speak (more frequent for better engagement)
    const talkyInterval = setInterval(checkTalky, TALKY_CHECK_INTERVAL)
    
    // Periodically reload full message list to catch Talky messages and any missed updates
    const messageRefreshInterval = setInterval(() => {
      loadMessages(100) // Load more messages periodically to catch Talky
    }, MESSAGE_REFRESH_INTERVAL) // Reduced frequency to avoid rate limit

    // Track user interactions
    const handleInteraction = () => {
      lastActivityRef.current = Date.now()
    }
    
    window.addEventListener('mousemove', handleInteraction, { passive: true })
    window.addEventListener('keydown', handleInteraction, { passive: true })
    window.addEventListener('click', handleInteraction, { passive: true })

    return () => {
      // Cleanup realtime subscriptions
      unsubscribeChat?.catch(() => {})
      unsubscribeActivity?.catch(() => {})
      
      clearInterval(activityHeartbeat)
      clearInterval(inactivityCheck)
      clearInterval(talkyInterval)
      clearInterval(messageRefreshInterval)
      
      window.removeEventListener('mousemove', handleInteraction)
      window.removeEventListener('keydown', handleInteraction)
      window.removeEventListener('click', handleInteraction)
      
      // Remove user from online list
      removeActivity()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadUser = async () => {
    try {
      const currentUser = authState.user
      if (!currentUser) return
      
      // Fetch full user data from database to get username
      const users = await db.db.users.list({
        where: { id: currentUser.id },
        limit: 1
      })
      
      const fullUser = users && users.length > 0 ? users[0] : currentUser
      setUser(fullUser)
    } catch (error) {
      console.error('Failed to load user:', error)
    }
  }

  const loadMessages = async (limit: number = INITIAL_LOAD_LIMIT) => {
    try {
      const msgs = await requestCache.getOrFetch(
        `chat-messages-${limit}`,
        () => db.db.chatMessages.list({
          orderBy: { createdAt: 'desc' },
          limit
        }),
        CACHE_TTL
      )
      
      // Reverse to get chronological order (oldest first)
      const sortedMessages = msgs.reverse()
      setMessages(sortedMessages)
      
      // Async stats update - don't block message display
      if (sortedMessages.length > 0) {
        db.db.chatStats.list({ limit: 1 }).then(stats => {
          if (stats && stats.length > 0) {
            db.db.chatStats.update(stats[0].id, {
              lastMessageAt: sortedMessages[sortedMessages.length - 1].createdAt
            }).catch(e => console.error('Failed to update chat stats:', e))
          }
        })
      }
    } catch (error) {
      console.error('Failed to load messages:', error)
    }
  }

  const loadOnlineUsers = async () => {
    try {
      // Get all users active in last 2 minutes
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()
      const active = await requestCache.getOrFetch(
        'chat-online-users',
        () => db.db.chatActivity.list({
          where: { lastActivity: { '>': twoMinutesAgo } }
        }),
        CACHE_TTL
      )
      setOnlineUsers(active)
      
      // Update total users count in stats (async, non-blocking)
      db.db.chatStats.list({ limit: 1 }).then(stats => {
        if (stats && stats.length > 0) {
          db.db.chatStats.update(stats[0].id, {
            totalUsers: active.length
          }).catch(e => console.error('Failed to update chat stats:', e))
        }
      }).catch(e => console.error('Failed to load chat stats:', e))
    } catch (error: any) {
      // Silently handle rate limit errors
      if (error?.status !== 429 && error?.code !== 'RATE_LIMIT_EXCEEDED') {
        console.error('Failed to load online users:', error)
      }
    }
  }

  const updateActivity = async () => {
    if (!user) return
    
    try {
      const username = formatBrandName(user.username || user.displayName || 'Anonymous')
      const existing = await db.db.chatActivity.list({
        where: { userId: user.id },
        limit: 1
      })
      
      if (existing && existing.length > 0) {
        await db.db.chatActivity.update(existing[0].id, {
          lastActivity: new Date().toISOString()
        })
      } else {
        await db.db.chatActivity.create({
          id: `activity-${user.id}`,
          userId: user.id,
          username,
          lastActivity: new Date().toISOString()
        })
      }
      
      // Publish activity update to realtime channel so other users see it instantly
      db.realtime.publish(ACTIVITY_CHANNEL, 'activity-update', {
        userId: user.id,
        username,
        timestamp: Date.now()
      }).catch(e => console.error('Failed to publish activity:', e))
    } catch (error) {
      console.error('Failed to update activity:', error)
    }
  }

  const removeActivity = async () => {
    if (!user) return
    
    try {
      const existing = await db.db.chatActivity.list({
        where: { userId: user.id },
        limit: 1
      })
      
      if (existing && existing.length > 0) {
        await db.db.chatActivity.delete(existing[0].id)
      }
    } catch (error) {
      console.error('Failed to remove activity:', error)
    }
  }

  const checkInactivity = () => {
    const timeSinceActivity = Date.now() - lastActivityRef.current
    
    if (timeSinceActivity >= INACTIVITY_TIMEOUT) {
      toast.error('Redirecting due to inactivity...')
      navigate('/')
    }
  }

  const checkTalky = async () => {
    try {
      // Call Talky bot edge function
      const response = await fetch('https://7e3gh26u--talky-bot.functions.blink.new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'check-and-speak'
        })
      })
      
      if (!response.ok) {
        // Silently ignore non-OK responses (rate limits, server errors)
        return
      }
      
      const data = await response.json()
      
      if (data.spoke) {
        // Reload messages to show Talky's message
        loadMessages()
      }
    } catch (error) {
      // Silently ignore network errors - don't spam console
    }
  }

  const invokeTalky = async (context: string) => {
    if (!user) return
    
    try {
      const actualUsername = formatBrandName(user.username || user.displayName || 'Anonymous')
      
      const response = await fetch('https://7e3gh26u--talky-bot.functions.blink.new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'invoke',
          context,
          userId: user.id,
          username: actualUsername
        })
      })
      
      const data = await response.json()
      
      if (data.spoke && data.message) {
        toast.success('Talky responded!')
        // Reload messages immediately to show Talky's response
        loadMessages()
      }
    } catch (error) {
      console.error('Failed to invoke Talky:', error)
      toast.error('Failed to summon Talky')
    }
  }

  const checkForTickers = async (message: string) => {
    try {
      // Check if message contains ticker pattern $(SYMBOL) or $SYMBOL
      const tickerPattern = /\$\(([A-Za-z0-9]+)\)|\$([A-Za-z0-9]+)/
      if (!tickerPattern.test(message)) {
        return // No tickers found
      }

      // Call price bot to process the message
      const response = await fetch('https://7e3gh26u--price-bot.functions.blink.new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'process-message',
          message
        })
      })
      
      const data = await response.json()
      
      if (data.processed) {
        // Wait a bit then reload to see PriceBot's response
        setTimeout(() => {
          loadMessages()
        }, 1000)
      }
    } catch (error) {
      console.error('Failed to check for tickers:', error)
      // Fail silently - don't disrupt user experience
    }
  }

  const handleSlashCommand = (command: string): boolean => {
    const trimmed = command.trim().toLowerCase()
    
    if (trimmed === '/help' || trimmed === '/?') {
      setShowCommandHelp(true)
      return true
    }
    
    if (trimmed === '/anon') {
      const newAnonState = !displayAsAnonymous
      setDisplayAsAnonymous(newAnonState)
      localStorage.setItem('chat-anonymous', newAnonState.toString())
      toast.success(newAnonState ? 'Now posting as Anonymous' : 'Now posting with your username', { duration: 3000 })
      return true
    }
    
    if (trimmed === '/online' || trimmed === '/who') {
      const userList = onlineUsers.map(u => u.username).join(', ')
      toast.success(`${onlineUsers.length} users online: ${userList}`, { duration: 5000 })
      return true
    }
    
    if (trimmed === '/invite') {
      setShowInviteDialog(true)
      return true
    }
    
    if (trimmed === '/limit' || trimmed === '/capacity') {
      const totalUsers = onlineUsers.length
      const remaining = MAX_USERS - totalUsers
      toast.success(`User capacity: ${totalUsers}/${MAX_USERS} (${remaining} slots remaining)`, { duration: 4000 })
      return true
    }
    
    if (trimmed === '/profile' || trimmed === '/me') {
      loadUserProfile()
      return true
    }
    
    if (trimmed.startsWith('/room')) {
      toast('Room creation coming soon! For now, we have one global room.', { icon: '🚧' })
      return true
    }
    
    return false
  }

  const loadUserProfile = async () => {
    if (!user) return
    
    try {
      const actualUsername = formatBrandName(user.username || user.displayName || 'Anonymous')
      
      const response = await fetch('https://7e3gh26u--talky-bot.functions.blink.new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'get-user-profile',
          userId: user.id,
          username: actualUsername
        })
      })
      
      const data = await response.json()
      
      if (data.profile) {
        setUserProfile(data)
        setShowProfileDialog(true)
      } else {
        toast.error('No profile data found')
      }
    } catch (error) {
      console.error('Failed to load profile:', error)
      toast.error('Failed to load profile')
    }
  }

  const sendMessage = async (content: string) => { // Changed signature to accept content
    if (!content.trim() || !user) return

    try {
      // Check for slash commands
      if (content.startsWith('/')) {
        const handled = handleSlashCommand(content)
        if (handled) {
          return
        }
      }
      
      // Use "Anon" if anonymous mode is enabled, otherwise use actual username
      const actualUsername = formatBrandName(user.username || user.displayName || 'Anonymous')
      const username = displayAsAnonymous ? 'Anon' : actualUsername
      const isInvokingTalky = content.toLowerCase().includes('@talky') || content.toLowerCase().includes('talky,')
      
      // Create message object for DB
      const messageId = `msg-${Date.now()}-${user.id}`
      const createdAt = new Date().toISOString()
      
      const newMessageObj: ChatMessage = {
        id: messageId,
        userId: user.id,
        username,
        content,
        isBot: 0,
        createdAt
      }
      
      // Removed setNewMessage('') since it's handled in ChatInput
      
      // Update activity immediately in UI
      lastActivityRef.current = Date.now()
      
      // Save to database first, then publish to realtime
      // This ensures the message exists in DB before other clients see it
      await db.db.chatMessages.create({
        id: messageId,
        userId: user.id,
        username,
        content,
        isBot: 0,
        createdAt
      })
      
      // Publish to realtime channel for other users - don't add to own UI yet
      db.realtime.publish(REALTIME_CHANNEL, 'message', newMessageObj).catch(e => {
        console.error('Failed to publish message:', e)
      })
      
      // Load messages to ensure we have the latest (and avoid optimistic update duplication)
      loadMessages()
      
      // Async activity update
      updateActivity()
      
      // If user invoked Talky, trigger response (doesn't block)
      if (isInvokingTalky) {
        invokeTalky(content)
      }

      // Check for ticker symbols and trigger PriceBot if found (doesn't block)
      checkForTickers(content)
    } catch (error) {
      console.error('Failed to send message:', error)
      toast.error('Failed to send message')
    }
  }

  // Removed handleKeyPress from here
  // const handleKeyPress = (e: React.KeyboardEvent) => { // Removed handleKeyPress from here
  //   if (e.key === 'Enter' && !e.shiftKey) {
  //     e.preventDefault()
  //     sendMessage(newMessage) // This won't work directly anymore, need refactor
  //   }
  // }
// ... existing code ...
  if (!user) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground font-mono">Loading chat...</div>
      </div>
    )
  }

  return (
    <>
      <div className="h-full flex border-2 border-foreground">
        {/* Chat messages */}
        <div className="flex-1 flex flex-col">
          <div className="border-b-2 border-foreground p-2 bg-background flex items-center justify-between">
            <div>
              <h3 className="font-bold font-mono">GLOBAL CHAT</h3>
              <p className="text-[10px] font-mono opacity-60">
                Type /help for commands | @talky learns from you | $(ticker) for prices | /profile to see your personality {displayAsAnonymous && '| [ANON MODE]'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCommandHelp(true)}
              className="font-mono text-xs"
            >
              /help
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.map((msg) => {
              const isBot = Number(msg.isBot) > 0
              const isSelf = msg.userId === user.id
              
              return (
                <div
                  key={msg.id}
                  className={`border border-foreground p-2 ${
                    isBot ? 'bg-muted border-2' : 
                    isSelf ? 'bg-foreground text-background' : 
                    'bg-background'
                  }`}
                >
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="font-bold font-mono text-xs flex items-center gap-1">
                      {isBot && <Bot className="w-3 h-3" />}
                      {msg.username}
                      {isBot && <span className="text-[9px] opacity-60">(AI)</span>}
                    </span>
                    <span className="text-[10px] font-mono opacity-60">
                      {new Date(msg.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="font-mono text-xs break-words">{msg.content}</div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          <ChatInput onSend={sendMessage} disabled={!user} />
        </div>

        {/* Online users sidebar */}
        <div className="w-48 border-l-2 border-foreground flex flex-col">
          <div className="border-b-2 border-foreground p-2 bg-background">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <UsersIcon className="w-4 h-4" />
                <span className="font-bold font-mono text-xs">
                  ONLINE
                </span>
              </div>
              <span className="text-xs font-mono">
                {onlineUsers.length}/{MAX_USERS}
              </span>
            </div>
            <div className="text-[9px] font-mono text-muted-foreground">
              anti-scale limit
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {onlineUsers.map((onlineUser) => {
              const isTalky = onlineUser.userId === 'talky-bot'
              
              return (
                <div
                  key={onlineUser.userId}
                  className={`flex items-center gap-2 p-1 border ${
                    isTalky ? 'border-2 border-foreground bg-muted' : 'border-foreground'
                  }`}
                >
                  {isTalky ? (
                    <Bot className="w-3 h-3" />
                  ) : (
                    <div className="w-2 h-2 bg-foreground rounded-full" />
                  )}
                  <span className="font-mono text-xs truncate">
                    {onlineUser.username}
                    {isTalky && <span className="text-[9px] opacity-60 ml-1">(AI)</span>}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Command Help Dialog */}
      <Dialog open={showCommandHelp} onOpenChange={setShowCommandHelp}>
        <DialogContent className="font-mono">
          <DialogHeader>
            <DialogTitle>Chat Commands</DialogTitle>
            <DialogDescription>
              Available slash commands for Haichan chat
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="border border-foreground p-2">
              <div className="font-bold">/help or /?</div>
              <div className="text-xs text-muted-foreground">Show this help menu</div>
            </div>
            <div className="border border-foreground p-2">
              <div className="font-bold">/anon</div>
              <div className="text-xs text-muted-foreground">Toggle anonymous mode (display as "Anon")</div>
            </div>
            <div className="border border-foreground p-2">
              <div className="font-bold">/online or /who</div>
              <div className="text-xs text-muted-foreground">List all online users</div>
            </div>
            <div className="border border-foreground p-2">
              <div className="font-bold">/limit or /capacity</div>
              <div className="text-xs text-muted-foreground">Show user capacity (256 max)</div>
            </div>
            <div className="border border-foreground p-2">
              <div className="font-bold">/profile or /me</div>
              <div className="text-xs text-muted-foreground">View your Talky personality profile</div>
            </div>
            <div className="border border-foreground p-2">
              <div className="font-bold">/invite</div>
              <div className="text-xs text-muted-foreground">Generate invite code (admins only)</div>
            </div>
            <div className="border border-foreground p-2">
              <div className="font-bold">/room [name]</div>
              <div className="text-xs text-muted-foreground">Create new chat room (coming soon)</div>
            </div>
            <div className="border border-foreground p-2">
              <div className="font-bold">@talky [question or debate]</div>
              <div className="text-xs text-muted-foreground">Ask Talky to mediate, research, or clarify topics</div>
            </div>
            <div className="border border-foreground p-2">
              <div className="font-bold">$(TICKER) or $TICKER</div>
              <div className="text-xs text-muted-foreground">Get crypto/stock prices (e.g., $(BTC), $ETH, $AAPL)</div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="font-mono">
          <DialogHeader>
            <DialogTitle>Invite Users</DialogTitle>
            <DialogDescription>
              Generate invite codes for new users (admin only)
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm text-muted-foreground p-4 border-2 border-dashed">
            This feature is restricted to administrators. Please contact an admin to generate invite codes.
          </div>
        </DialogContent>
      </Dialog>

      {/* User Profile Dialog */}
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="font-mono max-w-2xl">
          <DialogHeader>
            <DialogTitle>🤖 Talky's Profile of You</DialogTitle>
            <DialogDescription>
              How Talky remembers and adapts to your personality
            </DialogDescription>
          </DialogHeader>
          {userProfile && userProfile.profile && (
            <div className="space-y-3 text-sm">
              <div className="border border-foreground p-3">
                <div className="font-bold mb-2">📊 Basic Stats</div>
                <div className="space-y-1 text-xs">
                  <div>Interactions: <span className="font-bold">{userProfile.profile.interactionCount}</span></div>
                  <div>Last interaction: <span className="font-bold">{new Date(userProfile.profile.lastInteraction).toLocaleString()}</span></div>
                  <div>Member since: <span className="font-bold">{new Date(userProfile.profile.createdAt).toLocaleDateString()}</span></div>
                </div>
              </div>

              <div className="border border-foreground p-3">
                <div className="font-bold mb-2">🎭 Personality Traits</div>
                <div className="space-y-1 text-xs">
                  {(() => {
                    const traits = JSON.parse(userProfile.profile.personalityTraits)
                    return Object.entries(traits).map(([key, value]: [string, any]) => (
                      <div key={key} className="flex justify-between">
                        <span className="capitalize">{key}:</span>
                        <span className="font-bold">{Math.round(value * 100)}%</span>
                      </div>
                    ))
                  })()}
                </div>
              </div>

              <div className="border border-foreground p-3">
                <div className="font-bold mb-2">💬 Communication Style</div>
                <div className="space-y-1 text-xs">
                  {(() => {
                    const style = JSON.parse(userProfile.profile.communicationStyle)
                    return Object.entries(style).map(([key, value]: [string, any]) => (
                      <div key={key} className="flex justify-between">
                        <span className="capitalize">{key}:</span>
                        <span className="font-bold">{Math.round(value * 100)}%</span>
                      </div>
                    ))
                  })()}
                </div>
              </div>

              <div className="border border-foreground p-3">
                <div className="font-bold mb-2">📚 Topics Discussed</div>
                <div className="text-xs">
                  {JSON.parse(userProfile.profile.topicsDiscussed).length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {JSON.parse(userProfile.profile.topicsDiscussed).map((topic: string, i: number) => (
                        <span key={i} className="border border-foreground px-2 py-1">{topic}</span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">No topics yet - start chatting!</span>
                  )}
                </div>
              </div>

              {userProfile.interactions && userProfile.interactions.length > 0 && (
                <div className="border border-foreground p-3">
                  <div className="font-bold mb-2">🕒 Recent Interactions</div>
                  <div className="space-y-2 text-xs max-h-48 overflow-y-auto">
                    {userProfile.interactions.slice(0, 5).map((interaction: any) => (
                      <div key={interaction.id} className="border-b border-foreground pb-2 last:border-0">
                        <div className="flex justify-between mb-1">
                          <span className="text-[10px] opacity-60">{interaction.contextType}</span>
                          <span className="text-[10px] opacity-60">{new Date(interaction.createdAt).toLocaleString()}</span>
                        </div>
                        <div className="mb-1"><span className="font-bold">You:</span> {interaction.messageContent}</div>
                        {interaction.talkyResponse && (
                          <div><span className="font-bold">Talky:</span> {interaction.talkyResponse}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground p-2 border-2 border-dashed">
                💡 Talky uses this profile to tailor responses to your personality and interests. The more you interact, the better Talky understands you!
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
