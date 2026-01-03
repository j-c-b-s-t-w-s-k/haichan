import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import db from '../../lib/db-client'
import { formatBrandName } from '../../lib/utils'
import { Button } from '../ui/button'
import { withRateLimit } from '../../lib/rate-limit-utils'
import { requestCache } from '../../lib/request-cache'
import { useRealtimeListener } from '../../hooks/use-realtime-subscription'

interface PostersFilterProps {
  onFilterChange?: (selectedPosters: string[] | null) => void
}

const CACHE_TTL = 30000 // 30 second cache for posters filter

export function PostersFilter({ onFilterChange }: PostersFilterProps) {
  const [allPosters, setAllPosters] = useState<any[]>([])
  const [selectedPosters, setSelectedPosters] = useState<string[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load initial posters on mount
  useEffect(() => {
    loadPosters()
  }, [])

  // Setup real-time subscription for instant updates
  // Using shared hook prevents duplicate subscriptions when multiple components listen to same channel
  useRealtimeListener(
    'posters-updates',
    (message: any) => {
      if (message.type === 'poster-activity' || message.type === 'post-created' || message.type === 'thread-created' || message.type === 'user-registered') {
        // Invalidate cache and reload instantly
        requestCache.invalidate('posters-filter-users')
        loadPosters()
      }
    },
    ['poster-activity', 'post-created', 'thread-created', 'user-registered']
  )

  const loadPosters = async () => {
    try {
      const users = await requestCache.getOrFetch(
        'posters-filter-users',
        () => withRateLimit(
          () => db.db.users.list({
            orderBy: { totalPowPoints: 'desc' },
            limit: 100
          }),
          { maxRetries: 5, initialDelayMs: 200 }
        ),
        CACHE_TTL
      )
      
      // Filter to active posters
      const activePostersList = users
        .filter(u => u.username || u.displayName)
        .map(user => ({
          id: user.id,
          username: formatBrandName(user.username || user.displayName || 'Anonymous')
        }))
        .sort((a, b) => a.username.localeCompare(b.username))

      setAllPosters(activePostersList)
    } catch (error: any) {
      // Silently handle rate limit errors - keep existing data
      if (error?.status !== 429 && error?.code !== 'RATE_LIMIT_EXCEEDED') {
        console.error('Failed to load posters:', error)
      }
    } finally {
      setLoading(false)
    }
  }

  const togglePoster = (posterId: string) => {
    const updated = selectedPosters.includes(posterId)
      ? selectedPosters.filter(p => p !== posterId)
      : [...selectedPosters, posterId]
    
    setSelectedPosters(updated)
    onFilterChange?.(updated.length > 0 ? updated : null)
  }

  const clearSelection = () => {
    setSelectedPosters([])
    onFilterChange?.(null)
  }

  const selectedPosterNames = selectedPosters
    .map(id => allPosters.find(p => p.id === id)?.username)
    .filter(Boolean)

  return (
    <div className="border border-black p-2 font-mono text-xs">
      <div className="mb-2">
        <div className="font-bold mb-1 flex items-center justify-between">
          <span>Filter by Poster</span>
          {selectedPosters.length > 0 && (
            <Button
              onClick={clearSelection}
              variant="ghost"
              size="sm"
              className="h-4 p-1 text-[10px]"
            >
              Clear
            </Button>
          )}
        </div>

        {/* Selected Tags */}
        {selectedPosters.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {selectedPosterNames.map((name) => (
              <div
                key={name}
                className="border border-black px-2 py-0.5 bg-black text-white text-[9px] flex items-center gap-1"
              >
                <span>{name}</span>
                <button
                  onClick={() => togglePoster(
                    allPosters.find(p => p.username === name)?.id || ''
                  )}
                  className="hover:opacity-70"
                >
                  <X className="w-2 h-2" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Dropdown Trigger */}
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="w-full border border-black p-1 text-left text-[10px] hover:bg-gray-100"
        >
          {selectedPosters.length === 0
            ? 'Select posters...'
            : `${selectedPosters.length} selected`}
        </button>

        {/* Dropdown Menu */}
        {showDropdown && (
          <div className="absolute mt-1 z-50 border border-black bg-white max-h-48 overflow-y-auto w-[calc(100%-16px)]">
            {loading ? (
              <div className="p-2 text-center text-gray-500 text-[9px]">loading...</div>
            ) : allPosters.length > 0 ? (
              allPosters.map(poster => (
                <button
                  key={poster.id}
                  onClick={() => togglePoster(poster.id)}
                  className={`w-full text-left px-2 py-1 text-[9px] border-b border-gray-200 hover:bg-gray-100 flex items-center gap-2 ${
                    selectedPosters.includes(poster.id) ? 'bg-gray-100 font-bold' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedPosters.includes(poster.id)}
                    onChange={() => {}}
                    className="w-3 h-3"
                  />
                  <span>{poster.username}</span>
                </button>
              ))
            ) : (
              <div className="p-2 text-center text-gray-500 text-[9px]">no posters found</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
