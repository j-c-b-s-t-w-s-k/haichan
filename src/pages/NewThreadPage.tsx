import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Checkbox } from '../components/ui/checkbox'
import { MessageSquare, ArrowLeft, Palette, Zap } from 'lucide-react'
import { DoodleMining } from '../components/views/DoodleMining'
import { CircularOrbImage } from '../components/ui/circular-orb-image'
import { parseTripcode, generateTripcode } from '../lib/tripcode'
import db from '../lib/db-client'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { isValidImageForBoard, getAllowedImageTypesForBoard, getImageValidationError } from '../lib/image-validation'
import { saveToImageLibrary } from '../lib/image-library'
import { fetchPostNumberWithPoW, getPoWValidationData } from '../lib/pow-validation'
import { usePoWValidity } from '../hooks/use-pow-validity'
import { MiningManager } from '../lib/mining/MiningManager'
import { invokeFunction } from '../lib/functions-utils'
import { useMining } from '../hooks/use-mining'

export function NewThreadPage() {
  const { boardSlug } = useParams<{ boardSlug: string }>()
  const { authState } = useAuth()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [nameField, setNameField] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [board, setBoard] = useState<any>(null)
  const [initializing, setInitializing] = useState(true)
  const [postAsAnonymous, setPostAsAnonymous] = useState(false)
  const [showDoodleMining, setShowDoodleMining] = useState(false)
  const [doodleImageUrl, setDoodleImageUrl] = useState<string | null>(null)
  const [clipboardImageUrl, setClipboardImageUrl] = useState<string | null>(null)
  const miningManagerRef = useRef(MiningManager.getInstance())
  const navigate = useNavigate()
  const hasValidPoW = usePoWValidity()
  const { dedicatedSession } = useMining()
  
  // Check if this is the doodle board
  const isDoodleBoard = boardSlug === 'd'

  // Load clipboard image from localStorage
  useEffect(() => {
    const clipboardImage = localStorage.getItem('clipboard-image')
    if (clipboardImage) {
      setClipboardImageUrl(clipboardImage)
      setImagePreview(clipboardImage)
      toast.success('Using image from clipboard!', { duration: 3000 })
    }
  }, [])

  // Session persistence for content
  useEffect(() => {
    const sessionKey = `newthread-${boardSlug}`
    const savedContent = sessionStorage.getItem(sessionKey)
    if (savedContent) {
      try {
        const parsed = JSON.parse(savedContent)
        setTitle(parsed.title || '')
        setContent(parsed.content || '')
      } catch (e) {
        console.error('Failed to restore session:', e)
      }
    }
  }, [boardSlug])

  // Save content to session on change
  useEffect(() => {
    if (title || content) {
      const sessionKey = `newthread-${boardSlug}`
      sessionStorage.setItem(sessionKey, JSON.stringify({ title, content }))
    }
  }, [title, content, boardSlug])

  // Start dedicated mining on mount (unless doodle board)
  useEffect(() => {
    if (!isDoodleBoard) {
      console.log('[NewThreadPage] Starting dedicated mining for thread creation...')
      miningManagerRef.current.startDedicatedMining('thread', undefined, 15, '21e8')
        .catch(err => console.error('[NewThreadPage] Mining error:', err))
    }
    
    return () => {
      // Don't stop mining on unmount - let it continue in background
      // Only stop if user navigates away from thread creation
    }
  }, [isDoodleBoard])

  useEffect(() => {
    initializePage()
    // Auto-enable doodle mining for /d/ board
    if (isDoodleBoard) {
      setShowDoodleMining(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardSlug, isDoodleBoard])

  const initializePage = async () => {
    try {
      // Get current user from auth
      if (!authState.user?.id) {
        toast.error('Please log in first')
        navigate('/login')
        return
      }
      
      // Fetch full user data from database to get username
      const users = await db.db.users.list({
        where: { id: authState.user.id },
        limit: 1
      })
      
      const fullUser = users && users.length > 0 ? users[0] : authState.user
      setUser(fullUser)

      // Get board
      if (boardSlug) {
        const boards = await db.db.boards.list({
          where: { slug: boardSlug }
        })

        if (boards.length > 0) {
          setBoard(boards[0])
        } else {
          toast.error('Board not found')
          navigate('/boards')
          return
        }
      }
    } catch (error) {
      toast.error('Please log in first')
      navigate('/login')
    } finally {
      setInitializing(false)
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate image type for board
      if (!isValidImageForBoard(file, boardSlug)) {
        toast.error(getImageValidationError(boardSlug))
        e.target.value = '' // Clear input
        return
      }

      setImageFile(file)
      setDoodleImageUrl(null) // Clear doodle if file is uploaded
      setClipboardImageUrl(null) // Clear clipboard if file is uploaded
      const reader = new FileReader()
      reader.onload = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleDoodleGenerated = (imageUrl: string) => {
    setDoodleImageUrl(imageUrl)
    setImagePreview(imageUrl)
    setImageFile(null) // Clear file input if doodle is used
    setClipboardImageUrl(null) // Clear clipboard if doodle is used
    toast.success('Doodle ready! You can now create your thread.')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Special validation for /d/ Doodle board
    const isDoodleBoard = boardSlug === 'd'

    if (!isDoodleBoard && !title.trim()) {
      toast.error('Subject is required')
      return
    }

    if (!isDoodleBoard && !content.trim()) {
      toast.error('Content is required')
      return
    }

    if (isDoodleBoard && (content.trim() || title.trim())) {
      toast.error('The /d/ board only allows doodles - no text content!')
      return
    }

    if (!imageFile && !doodleImageUrl && !clipboardImageUrl) {
      toast.error('Image is required for new threads')
      return
    }

    if (isDoodleBoard && imageFile && !doodleImageUrl) {
      toast.error('The /d/ board requires doodles created in the doodle miner!')
      return
    }

    if (!board) {
      toast.error('Board not found')
      return
    }

    setLoading(true)

    try {
      // Always use the database username - no parsing from name field
      const username = user.username || 'Anonymous'
      
      // Only parse tripcode from name field (for the tripcode part, not username)
      let tripcode = ''
      if (nameField) {
        const { password, isSecure } = parseTripcode(nameField)
        if (password) {
          tripcode = await generateTripcode(password, isSecure)
        }
      }

      // Use clipboard image, doodle URL, or upload file
      let publicUrl = clipboardImageUrl || doodleImageUrl

      if (!publicUrl && imageFile) {
        // Upload image first
        const extension = imageFile.name.split('.').pop()
        // Generate random filename to avoid conflicts
        const randomId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
        const uploadResult = await db.storage.upload(
          imageFile,
          `threads/${Date.now()}-${randomId}.${extension}`,
          { upsert: true }
        )
        publicUrl = uploadResult.publicUrl
        
        // Save to image library
        await saveToImageLibrary(publicUrl, imageFile.name, imageFile.size, user.id)
      } else if (publicUrl) {
        // Using clipboard or doodle image - mark as used
        await saveToImageLibrary(publicUrl, 'Doodle or clipboard image', 0, user.id)
      }

      // Call edge function to get next post number with optional PoW validation
      let nextPostNumber: number;
      // Capture PoW data before it's consumed by fetchPostNumberWithPoW
      const powData = getPoWValidationData();

      try {
        console.log('Fetching post number from edge function (PoW optional)...');
        nextPostNumber = await fetchPostNumberWithPoW(true);
        console.log('✓ Post number received:', nextPostNumber);
      } catch (fetchError: any) {
        console.error('Failed to fetch post number from edge function:', fetchError);
        toast.error(fetchError.message || 'Failed to get post number. Please try again.');
        throw fetchError;
      }

      // Create thread with image and global post number
      // For doodle board, use default values for title and content
      const threadData: any = {
        boardId: board.id,
        userId: user.id,
        title: isDoodleBoard ? `Doodle #${nextPostNumber}` : title.trim(),
        content: isDoodleBoard ? '[Doodle]' : content.trim(),
        imageUrl: publicUrl,
        username: username || 'Anonymous',
        postNumber: nextPostNumber,
        totalPow: 0,
        bumpOrder: Math.floor(Date.now() / 1000),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      // Only add optional tripcode if it has a value
      if (tripcode) threadData.tripcode = tripcode

      const newThread = await db.db.threads.create(threadData)

      // Submit PoW to the new thread to bump it
      if (powData) {
        console.log('Submitting PoW to bump new thread:', newThread.id);
        // We use the same PoW that was used for post validation
        // This gives the new thread an initial totalPow > 0
        await invokeFunction('validate-pow', {
          body: {
            challenge: powData.challenge,
            nonce: powData.nonce,
            hash: powData.hash,
            points: powData.points,
            trailingZeros: powData.trailingZeros,
            prefix: powData.prefix,
            targetType: 'thread',
            targetId: newThread.id,
            userId: user.id
          }
        });
      }

      // Clear session storage on successful submission
      const sessionKey = `newthread-${boardSlug}`
      sessionStorage.removeItem(sessionKey)

      toast.success('Thread created successfully!')

      // Navigate back to board after a short delay
      setTimeout(() => {
        navigate(`/board/${boardSlug}`)
      }, 500)
    } catch (error: any) {
      toast.error(error.message || 'Failed to create thread')
      console.error('Error creating thread:', error)
    } finally {
      setLoading(false)
    }
  }

  if (initializing || !user || !board) {
    return (
      <div className="bg-white text-black min-h-screen flex items-center justify-center">
        <div className="text-center font-mono">
          <div className="text-2xl mb-2">LOADING...</div>
          <div className="text-gray-500">Verifying authentication and board</div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white text-black min-h-screen">
      <div className="container mx-auto p-4 max-w-6xl">
        <button
          onClick={() => navigate(`/board/${boardSlug}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-black font-mono text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          BACK TO BOARD
        </button>

        <div className="border-4 border-black bg-black text-white p-3 mb-6">
          <h1 className="text-2xl font-bold font-mono">
            NEW THREAD IN /{board.slug}/
          </h1>
          <p className="text-xs font-mono mt-1 text-gray-300">
            {board.description}
          </p>
        </div>

        <Card className="border-4 border-black">
          <CardHeader className="bg-black text-white border-b-4 border-black">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-6 h-6" />
              <div className="flex-1">
                <CardTitle className="text-xl font-mono">CREATE NEW THREAD</CardTitle>
                <CardDescription className="font-mono text-xs text-gray-300 mt-1">
                  Start a new discussion thread. Mining is running in the background.
                </CardDescription>
                {!isDoodleBoard && (
                  <div className={`mt-3 p-2 border rounded text-xs font-mono animate-pulse ${
                    hasValidPoW 
                      ? 'bg-green-900/20 border-green-500 text-green-300' 
                      : dedicatedSession 
                        ? 'bg-amber-600/20 border-amber-500 text-amber-100'
                        : 'bg-red-900/20 border-red-500 text-red-300'
                  }`}>
                    <div className="flex items-center gap-2">
                      <Zap className="w-3 h-3" />
                      <span>
                        {hasValidPoW 
                          ? '✓ Valid PoW collected! You can submit your thread.' 
                          : dedicatedSession 
                            ? '🔨 MINING ACTIVE - Proof-of-work is being collected. Continue below when ready to post.'
                            : '⚠ MINING STOPPED - Please refresh page or try again.'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {isDoodleBoard && (
              <div className="mb-6 p-4 border-4 border-red-600 bg-red-50 font-mono">
                <p className="font-bold text-red-600 mb-2">⚠ DOODLE BOARD ONLY</p>
                <p className="text-sm text-red-800">
                  This board accepts ONLY doodles created with the doodle miner below. 
                  No text content or uploaded images allowed!
                </p>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {!isDoodleBoard && (
                <>
                  <div>
                    <Label htmlFor="name" className="font-mono font-bold text-xs">
                      NAME (optional)
                    </Label>
                    <Input
                      id="name"
                      type="text"
                      value={nameField}
                      onChange={(e) => setNameField(e.target.value)}
                      className="font-mono mt-1 border-2 border-black"
                      placeholder="Anonymous or Name#tripcode"
                      disabled={loading}
                    />
                    <p className="text-xs text-gray-600 font-mono mt-1">
                      Use #password for tripcode or ##password for secure tripcode
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="title" className="font-mono font-bold">
                      SUBJECT *
                    </Label>
                    <Input
                      id="title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="font-mono mt-2 border-2 border-black"
                      placeholder="Enter thread subject..."
                      required
                      disabled={loading}
                    />
                  </div>
                </>
              )}

              <div>
                <Label htmlFor="image" className="font-mono font-bold">
                  {isDoodleBoard ? 'DOODLE *' : 'IMAGE *'}
                </Label>
                
                {/* Toggle between upload and doodle - hide on doodle board */}
                {!isDoodleBoard && (
                  <div className="flex gap-2 mt-2 mb-3">
                    <Button
                      type="button"
                      variant={!showDoodleMining ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setShowDoodleMining(false)}
                      disabled={loading}
                      className="font-mono"
                    >
                      Upload Image
                    </Button>
                    <Button
                      type="button"
                      variant={showDoodleMining ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setShowDoodleMining(true)}
                      disabled={loading}
                      className="font-mono"
                    >
                      <Palette className="w-3 h-3 mr-1" />
                      Draw Doodle
                    </Button>
                  </div>
                )}

                {showDoodleMining ? (
                  <DoodleMining 
                    onImageGenerated={handleDoodleGenerated} 
                    initialImage={imagePreview || undefined}
                  />
                ) : (
                  <>
                    <div className="space-y-2">
                      <Input
                        id="image"
                        type="file"
                        accept={boardSlug === 'gif' ? '.gif,.webm' : 'image/*,video/webm'}
                        onChange={handleImageChange}
                        className="font-mono border-2 border-black"
                        disabled={loading}
                      />
                      {boardSlug === 'gif' && (
                        <p className="text-xs font-mono text-red-600">
                          ⚠ This board only accepts GIF and WebM files
                        </p>
                      )}
                    </div>
                    {imagePreview && !doodleImageUrl && (
                      <div className="mt-3 border-2 border-black p-2 flex justify-center">
                        <CircularOrbImage
                          src={imagePreview}
                          alt="Preview"
                          size={256}
                        />
                      </div>
                    )}
                  </>
                )}

                {doodleImageUrl && (
                  <div className="mt-3 border-2 border-black p-2 flex flex-col items-center">
                    <p className="text-xs font-mono mb-2 text-green-600">✓ Doodle ready!</p>
                    <CircularOrbImage
                      src={doodleImageUrl}
                      alt="Doodle"
                      size={256}
                    />
                  </div>
                )}
              </div>

              {!isDoodleBoard && (
                <div>
                  <Label htmlFor="content" className="font-mono font-bold">
                    CONTENT *
                  </Label>
                  <Textarea
                    id="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="font-mono mt-2 border-2 border-black min-h-80 text-black"
                    placeholder="Enter your thread content..."
                    required
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-600 font-mono mt-2">
                    {content.length} / 10000 characters
                  </p>
                </div>
              )}

              <div className="flex items-center space-x-2 border-2 border-black p-3">
                <Checkbox
                  id="postAsAnonymous"
                  checked={postAsAnonymous}
                  onCheckedChange={(checked) => setPostAsAnonymous(checked as boolean)}
                  disabled={loading}
                />
                <Label
                  htmlFor="postAsAnonymous"
                  className="font-mono font-bold cursor-pointer"
                >
                  POST AS ANONYMOUS
                </Label>
              </div>

              <div className="bg-gray-100 border-2 border-black p-4 font-mono text-sm mb-4">
                <p className="font-bold mb-2">THREAD REQUIREMENTS:</p>
                {isDoodleBoard ? (
                  <ul className="list-disc list-inside space-y-1 text-gray-700">
                    <li>Only doodles created with the doodle miner are allowed</li>
                    <li>No text content, titles, or uploaded images permitted</li>
                    <li>You can upload an image first, then switch to doodle mode to draw on it</li>
                    <li>Use AI enhancement to refine your doodles</li>
                    <li>Threads are ranked by total proof-of-work accumulated</li>
                  </ul>
                ) : (
                  <ul className="list-disc list-inside space-y-1 text-gray-700">
                    <li>Subject and image are required for all new threads</li>
                    <li>Your thread will be posted immediately upon creation</li>
                    <li>Threads are ranked by total proof-of-work accumulated</li>
                    <li>Higher PoW = thread bumped to top of board</li>
                  </ul>
                )}
              </div>

              <div className={`border-2 p-4 font-mono text-sm mb-4 flex items-center gap-2 ${hasValidPoW ? 'bg-green-50 border-green-600' : 'bg-blue-50 border-blue-600'}`}>
                <Zap className={`w-5 h-5 ${hasValidPoW ? 'text-green-600' : 'text-blue-600 animate-pulse'}`} />
                <div>
                  <p className={`font-bold mb-1 ${hasValidPoW ? 'text-green-600' : 'text-blue-600'}`}>⚙ MINING STATUS</p>
                  <p className={hasValidPoW ? 'text-green-800' : 'text-blue-800'}>
                    {hasValidPoW 
                      ? '✓ Valid PoW found! You can now create your thread. Mining complete.' 
                      : '⚡ Mining in progress... Searching for hash starting with 21e8 (15+ points required). This may take a minute...'}
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <Button
                  type="submit"
                  className="font-mono flex-1 bg-black text-white border-2 border-black hover:bg-white hover:text-black disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading || !hasValidPoW}
                  title={!hasValidPoW ? 'Mining must produce PoW with hash starting with 21e8 and 15+ points' : ''}
                >
                  {loading ? 'CREATING...' : !hasValidPoW ? 'MINING PoW...' : 'CREATE THREAD'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="font-mono border-2 border-black"
                  onClick={() => navigate(`/board/${boardSlug}`)}
                  disabled={loading}
                >
                  CANCEL
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}