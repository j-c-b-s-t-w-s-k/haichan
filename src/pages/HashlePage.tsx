import { useState, useEffect, useCallback } from 'react'
import { Button } from '../components/ui/button'
import db from '../lib/db-client'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'

const HEX_KEYS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F']

// Simple hash function for daily hex code (client-side)
async function getDailyHex(date: Date): Promise<string> {
  const dateStr = date.toISOString().split('T')[0]
  const data = new TextEncoder().encode(dateStr + 'hashle-secret')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex.substring(0, 6).toUpperCase()
}

function getNextPuzzleTime(): string {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  
  const diff = tomorrow.getTime() - now.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export function HashlePage() {
  const { authState } = useAuth()
  const [targetHex, setTargetHex] = useState<string>('')
  const [guesses, setGuesses] = useState<string[]>([])
  const [currentGuess, setCurrentGuess] = useState('')
  const [gameOver, setGameOver] = useState(false)
  const [won, setWon] = useState(false)
  const [nextPuzzle, setNextPuzzle] = useState(getNextPuzzleTime())

  useEffect(() => {
    // Initialize daily hex
    getDailyHex(new Date()).then(setTargetHex)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setNextPuzzle(getNextPuzzleTime())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (currentGuess.length !== 6) {
      toast.error('Enter all 6 characters')
      return
    }

    const newGuesses = [...guesses, currentGuess]
    setGuesses(newGuesses)
    setCurrentGuess('')

    if (currentGuess === targetHex) {
      setGameOver(true)
      setWon(true)
      toast.success('You won!')
      
      try {
        if (authState.user) {
          // Fire and forget stats update
          db.db.users.update(authState.user.id, {
            hashleWins: (Number(authState.user.hashleWins) || 0) + 1,
            hashleScore: (Number(authState.user.hashleScore) || 0) + 1
          }).catch(console.error)
          
          db.db.gameSessions.create({
            id: `game_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            userId: authState.user.id,
            gameType: 'hashle',
            score: 7 - newGuesses.length,
            completed: 1,
            won: 1,
            endedAt: new Date().toISOString()
          }).catch(console.error)
        }
      } catch (error) {
        console.error('Failed to update score:', error)
      }
    } else if (newGuesses.length >= 6) {
      setGameOver(true)
      setWon(false)
      toast.error(`Game Over! Answer was ${targetHex}`)
      
      try {
        if (authState.user) {
          db.db.users.update(authState.user.id, {
            hashleLosses: (Number(authState.user.hashleLosses) || 0) + 1,
            hashleScore: (Number(authState.user.hashleScore) || 0) - 1
          }).catch(console.error)
          
          db.db.gameSessions.create({
            id: `game_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            userId: authState.user.id,
            gameType: 'hashle',
            score: 0,
            completed: 1,
            won: 0,
            endedAt: new Date().toISOString()
          }).catch(console.error)
        }
      } catch (error) {
        console.error('Failed to update score:', error)
      }
    }
  }, [currentGuess, guesses, targetHex, authState.user])

  const handleDelete = useCallback(() => {
    setCurrentGuess(prev => prev.slice(0, -1))
  }, [])

  const handleKeyPress = useCallback((key: string) => {
    if (gameOver) return
    if (currentGuess.length < 6) {
      setCurrentGuess(prev => prev + key)
    }
  }, [gameOver, currentGuess.length])

  // Handle physical keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameOver) return
      
      const key = e.key.toUpperCase()
      
      if (HEX_KEYS.includes(key)) {
        if (currentGuess.length < 6) {
          setCurrentGuess(prev => prev + key)
        }
      } else if (key === 'BACKSPACE') {
        setCurrentGuess(prev => prev.slice(0, -1))
      } else if (key === 'ENTER') {
        e.preventDefault()
        handleSubmit()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [gameOver, currentGuess.length, handleSubmit]) 

  const getCellColor = (guess: string, index: number) => {
    if (guess[index] === targetHex[index]) {
      return 'bg-green-500'
    } else if (targetHex.includes(guess[index])) {
      return 'bg-yellow-500'
    }
    return 'bg-gray-400'
  }

  if (!targetHex) {
    return (
      <div className="bg-white text-black min-h-screen flex items-center justify-center p-4">
        <div className="text-center font-mono">
          <div className="text-2xl mb-2">LOADING PUZZLE...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white text-black min-h-screen flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <h1 className="text-4xl font-bold text-center mb-2 font-mono">Hashle</h1>
        <p className="text-center text-gray-600 mb-8">Guess the 6-digit hex code in 6 attempts</p>

        <div className="border-2 border-black p-6 mb-4">
          <div className="text-center mb-2">
            <strong>Today's Puzzle</strong>
            <div className="text-sm text-gray-600">{new Date().toISOString().split('T')[0]}</div>
          </div>
          
          <div className="text-center mb-4">
            <div className="text-sm text-gray-600">Next puzzle in:</div>
            <div className="font-mono">{nextPuzzle}</div>
          </div>
        </div>

        {/* Game Board */}
        <div className="border-2 border-black p-6 mb-4">
          <div className="space-y-2 mb-6">
            {[...Array(6)].map((_, rowIndex) => (
              <div key={rowIndex} className="flex gap-2 justify-center">
                {[...Array(6)].map((_, colIndex) => {
                  const guess = guesses[rowIndex]
                  const char = guess ? guess[colIndex] : (rowIndex === guesses.length ? currentGuess[colIndex] : '')
                  const bgColor = guess ? getCellColor(guess, colIndex) : 'bg-white'
                  
                  return (
                    <div
                      key={colIndex}
                      className={`w-12 h-12 border-2 border-black flex items-center justify-center font-mono font-bold text-xl ${bgColor}`}
                    >
                      {char || ''}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          <div className="text-center mb-4 font-mono">
            Attempt {guesses.length + 1} / 6
          </div>

          {/* Keyboard */}
          {!gameOver && (
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-2">
                {HEX_KEYS.slice(0, 4).map(key => (
                  <Button key={key} onClick={() => handleKeyPress(key)} className="font-mono">
                    {key}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-6 gap-2">
                {HEX_KEYS.slice(4, 10).map(key => (
                  <Button key={key} onClick={() => handleKeyPress(key)} className="font-mono">
                    {key}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-6 gap-2">
                {HEX_KEYS.slice(10).map(key => (
                  <Button key={key} onClick={() => handleKeyPress(key)} className="font-mono">
                    {key}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button onClick={handleDelete} variant="outline" className="flex-1 font-mono">
                  ← Delete
                </Button>
                <Button 
                  id="hashle-submit-btn" 
                  onClick={handleSubmit} 
                  className="flex-1 font-mono bg-green-600 hover:bg-green-700"
                >
                  Submit
                </Button>
              </div>
            </div>
          )}

          {gameOver && (
            <div className="text-center">
              <div className={`text-2xl font-bold mb-4 ${won ? 'text-green-600' : 'text-red-600'}`}>
                {won ? `You Won in ${guesses.length} attempts!` : `Game Over!`}
              </div>
              <div className="mb-4">
                <div className="text-lg">Answer:</div>
                <div 
                  className="w-full h-20 border-2 border-black flex items-center justify-center font-mono font-bold text-2xl"
                  style={{ backgroundColor: `#${targetHex}` }}
                >
                  #{targetHex}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-2 border-black p-4 bg-yellow-50">
          <p className="text-sm font-mono">
            <strong>Rules:</strong> Green = correct position, Yellow = correct character wrong position, Gray = not in code
          </p>
        </div>
      </div>
    </div>
  )
}
