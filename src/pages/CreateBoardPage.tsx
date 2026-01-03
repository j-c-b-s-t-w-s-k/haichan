import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import db from '../lib/db-client'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

export function CreateBoardPage() {
  const navigate = useNavigate()
  const { authState } = useAuth()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)

  const handleNameChange = (value: string) => {
    setName(value)
    // Auto-generate slug from name
    const generatedSlug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .substring(0, 10)
    setSlug(generatedSlug)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name || !slug || !description) {
      toast.error('All fields are required')
      return
    }

    if (slug.length < 2 || slug.length > 10) {
      toast.error('Slug must be 2-10 characters')
      return
    }

    if (!/^[a-z0-9]+$/.test(slug)) {
      toast.error('Slug can only contain lowercase letters and numbers')
      return
    }

    setCreating(true)

    try {
      // Check if slug already exists
      const existing = await db.db.boards.list({
        where: { slug }
      })

      if (existing.length > 0) {
        toast.error('Board with this slug already exists')
        setCreating(false)
        return
      }

      // Verify user is authenticated
      if (!authState.user?.id) {
        toast.error('You must be logged in to create a board')
        navigate('/auth')
        return
      }

      // Create board (all user-created boards are public)
      await db.db.boards.create({
        id: `board_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        name,
        slug,
        description,
        totalPow: 0,
        lastActivityAt: new Date().toISOString(),
        expired: 0
      })

      toast.success('Board created successfully!')
      
      // Publish realtime event
      await db.realtime.publish('boards-updates', 'board-created', {
        slug,
        name
      })

      navigate(`/board/${slug}`)
    } catch (error: any) {
      console.error('Failed to create board:', error)
      toast.error(error.message || 'Failed to create board')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="bg-white text-black min-h-screen">
      <div className="container mx-auto p-4 max-w-2xl">
        <div className="border-2 border-gunmetal">
          <div className="bg-gunmetal text-celadon p-4 font-mono font-bold text-xl">
            CREATE NEW BOARD
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div>
              <label className="block font-mono font-bold mb-2">
                Board Name
              </label>
              <Input
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g., Technology"
                maxLength={50}
                className="font-mono"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                The display name of your board (max 50 chars)
              </p>
            </div>

            <div>
              <label className="block font-mono font-bold mb-2">
                Board Slug
              </label>
              <div className="flex items-center gap-2">
                <span className="font-mono text-gray-500">/</span>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  placeholder="tech"
                  maxLength={10}
                  pattern="[a-z0-9]+"
                  className="font-mono"
                  required
                />
                <span className="font-mono text-gray-500">/</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                URL-friendly identifier (2-10 chars, lowercase letters and numbers only)
              </p>
            </div>

            <div>
              <label className="block font-mono font-bold mb-2">
                Description
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this board is about..."
                maxLength={200}
                rows={4}
                className="font-mono"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Brief description of the board's topic (max 200 chars)
              </p>
            </div>

            <div className="border border-gray-300 p-4 bg-yellow-50">
              <p className="text-sm font-mono">
                <strong>Note:</strong> All user-created boards are public and visible to everyone.
                Boards with no activity for 7 days will automatically expire.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={creating}
                className="flex-1 font-mono font-bold"
              >
                {creating ? 'CREATING...' : 'CREATE BOARD'}
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
