import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Bell, Check, Trash2 } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import db from '../lib/db-client'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

export function NotificationsPage() {
  const navigate = useNavigate()
  const { authState } = useAuth()
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authState.user) {
      loadNotifications()
    }
  }, [authState.user])

  const loadNotifications = async () => {
    try {
      setLoading(true)
      const list = await db.db.notifications.list({
        where: { user_id: authState.user?.id },
        orderBy: { created_at: 'desc' },
        limit: 50
      })
      
      // Enrich with post details if needed, but for now just show them
      // We might want to fetch the thread title or post content
      // But let's assume we can navigate just by ID
      setNotifications(list)
    } catch (error) {
      console.error('Failed to load notifications', error)
      toast.error('Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (id: string) => {
    try {
      await db.db.notifications.update(id, { is_read: 1 })
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n))
    } catch (e) {
      console.error(e)
    }
  }

  const markAllAsRead = async () => {
    try {
      // Client-side loop since SDK might not support bulk update
      const unread = notifications.filter(n => !n.is_read)
      for (const n of unread) {
        await db.db.notifications.update(n.id, { is_read: 1 })
      }
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })))
      toast.success('All marked as read')
    } catch (e) {
      console.error(e)
      toast.error('Failed to mark all as read')
    }
  }
  
  const clearAll = async () => {
      if(!confirm('Delete all notifications?')) return
      try {
          // Bulk delete ideally
          for (const n of notifications) {
              await db.db.notifications.delete(n.id)
          }
          setNotifications([])
          toast.success('Cleared')
      } catch (e) {
          toast.error('Failed to clear')
      }
  }

  if (loading) {
    return (
      <div className="bg-celadon text-gunmetal min-h-screen flex items-center justify-center">
        <div className="text-center font-mono">LOADING...</div>
      </div>
    )
  }

  return (
    <div className="bg-celadon text-gunmetal min-h-screen">
      <div className="container mx-auto p-4 max-w-2xl">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-deep-teal hover:underline font-mono text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          BACK TO HOME
        </button>

        <div className="border border-gunmetal bg-white p-4 mb-4 flex justify-between items-center">
           <h1 className="text-xl font-mono font-bold flex items-center gap-2">
             <Bell className="w-5 h-5" />
             NOTIFICATIONS ({notifications.filter(n => !n.is_read).length})
           </h1>
           <div className="flex gap-2">
             <Button variant="outline" size="sm" onClick={markAllAsRead} className="font-mono text-xs">
               <Check className="w-3 h-3 mr-1" /> Mark Read
             </Button>
             <Button variant="outline" size="sm" onClick={clearAll} className="font-mono text-xs text-red-600 hover:text-red-700">
               <Trash2 className="w-3 h-3 mr-1" /> Clear
             </Button>
           </div>
        </div>

        <div className="space-y-2">
          {notifications.length === 0 ? (
            <div className="text-center py-8 font-mono text-gray-500">
              No notifications.
            </div>
          ) : (
            notifications.map(n => (
              <Card 
                key={n.id} 
                className={`border border-gunmetal cursor-pointer hover:bg-celadon/20 transition-colors ${!n.is_read ? 'bg-white border-l-4 border-l-deep-teal' : 'bg-gray-50 opacity-75'}`}
                onClick={() => {
                  markAsRead(n.id)
                  // We need to know the board slug. Usually notifications should store it or we fetch it.
                  // For now, let's try to assume we can find the thread.
                  // Wait, we stored thread_id. We can fetch the thread to get the board slug.
                  // Or we can just store board_slug in notifications in the future.
                  // Since we didn't store board_slug, we have to look it up or redirect to a route that handles ID.
                  // Let's assume we can fetch thread info.
                  
                  // For now, let's just use a loader or try to link to thread ID if possible.
                  // But our routes are /board/:slug/thread/:id
                  // So we MUST know the slug.
                  
                  // Quick fix: fetch thread to get slug before navigate?
                  db.db.threads.list({ where: { id: n.thread_id } }).then(threads => {
                    if (threads.length > 0) {
                      navigate(`/board/${threads[0].boardSlug || threads[0].board_slug || 'b'}/thread/${n.thread_id}#p${n.post_id}`) // Using 'b' as fallback
                    } else {
                      toast.error('Thread deleted or not found')
                    }
                  })
                }}
              >
                <CardContent className="p-3">
                   <div className="flex justify-between items-start">
                     <div>
                       <div className="font-mono text-xs font-bold text-deep-teal mb-1">
                         {n.type === 'reply' ? 'New Reply' : 'Notification'}
                         {!n.is_read && <span className="ml-2 text-red-500 text-[10px] animate-pulse">NEW</span>}
                       </div>
                       <div className="font-mono text-sm text-gunmetal">
                         Someone replied to you in thread #{n.thread_id.substring(0, 8)}...
                       </div>
                       <div className="font-mono text-[10px] text-gray-500 mt-2">
                         {new Date(n.created_at).toLocaleString()}
                       </div>
                     </div>
                   </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
