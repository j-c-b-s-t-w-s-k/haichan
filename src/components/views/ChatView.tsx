import { useState, useEffect, useRef } from 'react'
import { Send } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { BadgesInline } from '../../lib/badge-utils'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'

interface Message {
  id: string
  userId: string
  username: string
  content: string
  timestamp: number
  user?: any
}

export function ChatView() {
  const { authState } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Load initial messages - simulate chat with timestamps
    const sampleMessages: Message[] = [
      { id: '1', userId: 'sys', username: 'SYSTEM', content: 'Welcome to Haichan global chat', timestamp: Date.now() - 300000 },
      { id: '2', userId: 'anon1', username: 'Anonymous', content: 'mining in progress...', timestamp: Date.now() - 120000 },
      { id: '3', userId: 'anon2', username: 'Anonymous', content: 'found 21e8 hash!', timestamp: Date.now() - 60000 }
    ]
    setMessages(sampleMessages)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!newMessage.trim() || !authState.user) return

    try {
      const msg: Message = {
        id: Date.now().toString(),
        userId: authState.user.id,
        username: authState.user.username || 'Anonymous',
        content: newMessage,
        timestamp: Date.now()
      }
      
      setMessages(prev => [...prev, msg])
      setNewMessage('')
    } catch (error) {
      toast.error('Failed to send message')
    }
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="border-2 border-black bg-white">
      {/* Header */}
      <div className="border-b-2 border-black bg-black text-white px-3 py-1 font-mono text-sm font-bold">
        GLOBAL CHAT
      </div>

      {/* Messages */}
      <div className="h-[300px] overflow-y-auto p-3 space-y-2 font-mono text-xs">
        {messages.map((msg) => (
          <div key={msg.id} className="leading-tight">
            <span className="text-gray-600">[{formatTime(msg.timestamp)}]</span>{' '}
            <span className="font-bold flex items-center gap-0.5">
              {msg.username}
              <BadgesInline user={msg.user} className="inline-flex ml-0.5" />
            </span>
            {': '}
            <span>{msg.content}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t-2 border-black p-2 flex gap-2">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type message..."
          className="flex-1 h-8 border-2 border-black font-mono text-xs"
        />
        <Button
          onClick={sendMessage}
          className="h-8 px-3 bg-black text-white border-2 border-black hover:bg-white hover:text-black font-mono"
          size="sm"
        >
          <Send className="w-3 h-3" />
        </Button>
      </div>
    </div>
  )
}
