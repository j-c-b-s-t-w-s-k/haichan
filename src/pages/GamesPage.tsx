import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { HashlePage } from './HashlePage'

export function GamesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const gameParam = searchParams.get('game') as 'menu' | 'hashle' | 'traphouse' | null
  const [selectedGame, setSelectedGame] = useState<'menu' | 'hashle' | 'traphouse'>(gameParam || 'menu')

  useEffect(() => {
    const param = searchParams.get('game') as 'menu' | 'hashle' | 'traphouse'
    if (param && ['menu', 'hashle', 'traphouse'].includes(param)) {
      setSelectedGame(param)
    } else {
      setSelectedGame('menu')
    }
  }, [searchParams])

  const handleGameChange = (game: 'menu' | 'hashle' | 'traphouse') => {
    setSelectedGame(game)
    if (game === 'menu') {
      setSearchParams({})
    } else {
      setSearchParams({ game })
    }
  }

  if (selectedGame === 'hashle') {
    return (
      <div>
        <div className="p-2 border-b border-black bg-gray-100">
          <Button onClick={() => handleGameChange('menu')} variant="outline" size="sm">
            ← Back to Games Menu
          </Button>
        </div>
        <HashlePage />
      </div>
    )
  }

  if (selectedGame === 'traphouse') {
    return (
      <div className="h-screen flex flex-col">
        <div className="p-2 border-b border-black bg-gray-100">
          <Button onClick={() => handleGameChange('menu')} variant="outline" size="sm">
            ← Back to Games Menu
          </Button>
        </div>
        <iframe
          src="https://3dtrap.house"
          className="flex-1 w-full border-0"
          title="Trap House 3D"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }

  return (
    <div className="bg-white text-black min-h-screen p-8">
      <div className="container mx-auto max-w-4xl">
        <div className="border-2 border-gunmetal">
          <div className="bg-gunmetal text-celadon p-4 font-mono font-bold text-2xl">
            🎮 GAMES ARCADE
          </div>
          
          <div className="p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold font-mono mb-2">Available Games</h2>
              <p className="text-sm text-gray-600 mb-6">
                Play games to earn points! Wins increase your score, losses decrease it.
              </p>
            </div>

            {/* Hashle */}
            <div className="border-2 border-black p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-2xl font-bold font-mono mb-2">🎨 Hashle</h3>
                  <p className="text-gray-600 mb-4">
                    Guess the 6-digit hex color code in 6 attempts. Like Wordle but for hex codes!
                  </p>
                  <div className="text-sm text-gray-500 space-y-1">
                    <div>• Win: +1 point</div>
                    <div>• Lose: -1 point</div>
                    <div>• One puzzle per day</div>
                  </div>
                </div>
                <Button
                  onClick={() => handleGameChange('hashle')}
                  size="lg"
                  className="ml-4 font-mono font-bold"
                >
                  PLAY NOW
                </Button>
              </div>
            </div>

            {/* Trap House 3D */}
            <div className="border-2 border-black p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-2xl font-bold font-mono mb-2">🏠 Trap House 3D</h3>
                  <p className="text-gray-600 mb-4">
                    Trap drugs, get bitches and breed pitbulls. Oh, and kill everyone.
                  </p>
                  <div className="text-sm text-gray-500 space-y-1">
                    <div>• Full 3D experience</div>
                    <div>• Multiple levels</div>
                    <div>• Keyboard controls</div>
                  </div>
                </div>
                <Button
                  onClick={() => handleGameChange('traphouse')}
                  size="lg"
                  className="ml-4 font-mono font-bold"
                >
                  PLAY NOW
                </Button>
              </div>
            </div>

            {/* Info Box */}
            <div className="border border-gunmetal p-4 bg-celadon/20">
              <p className="text-sm font-mono">
                <strong>Leaderboard:</strong> Top players by Hashle score are displayed on the home page!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
