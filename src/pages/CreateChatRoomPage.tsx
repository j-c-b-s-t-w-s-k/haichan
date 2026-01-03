import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import db from '../lib/db-client'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'

export function CreateChatRoomPage() {
  const navigate = useNavigate()
  const { authState } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [maxUsers, setMaxUsers] = useState(256)
  const [creating, setCreating] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name || !description) {
      toast.error('Name and description are required')
      return
    }

    if (maxUsers < 2 || maxUsers > 1000) {
      toast.error('Max users must be between 2 and 1000')
      return
    }

    setCreating(true)

    try {
      // Get current user from auth state
      if (!authState.user) {
        toast.error('You must be logged in to create a chat room')
        navigate('/auth')
        return
      }

      // Create chat room (all user-created rooms are public)
      const room = await db.db.chatRooms.create({
        id: `room_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        userId: authState.user.id,
        name,
        description,
        isPublic: 1,
        maxUsers,
      })

      toast.success('Chat room created successfully!')
      navigate(`/chat/rooms`)
    } catch (error: any) {
      console.error('Failed to create chat room:', error)
      toast.error(error.message || 'Failed to create chat room')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="bg-white text-black min-h-screen">
      <div className="container mx-auto p-4 max-w-2xl">
        <div className="border-2 border-gunmetal">
          <div className="bg-gunmetal text-celadon p-4 font-mono font-bold text-xl">
            CREATE NEW CHAT ROOM
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div>
              <label className="block font-mono font-bold mb-2">
                Room Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., General Discussion"
                maxLength={100}
                className="font-mono"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                The display name of your chat room (max 100 chars)
              </p>
            </div>

            <div>
              <label className="block font-mono font-bold mb-2">
                Description
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this room is for..."
                maxLength={200}
                rows={4}
                className="font-mono"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Brief description of the room's purpose (max 200 chars)
              </p>
            </div>

            <div>
              <label className="block font-mono font-bold mb-2">
                Max Users
              </label>
              <Input
                type="number"
                value={maxUsers}
                onChange={(e) => setMaxUsers(Number(e.target.value))}
                min={2}
                max={1000}
                className="font-mono"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Maximum number of users allowed in this room (2-1000)
              </p>
            </div>

            <div className="border border-gray-300 p-4 bg-yellow-50">
              <p className="text-sm font-mono">
                <strong>Note:</strong> All user-created chat rooms are public and visible to everyone.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={creating}
                className="flex-1 font-mono font-bold"
              >
                {creating ? 'CREATING...' : 'CREATE ROOM'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
                className="font-mono font-bold"
              >
                CANCEL
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
