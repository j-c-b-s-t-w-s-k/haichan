import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { MessageSquare, ArrowLeft, X } from 'lucide-react'
import db from '../lib/db-client'
import toast from 'react-hot-toast'
import { parseTripcode, generateTripcode } from '../lib/tripcode'
import { isValidImageForBoard, getImageValidationError } from '../lib/image-validation'
import { saveToImageLibrary } from '../lib/image-library'
import { fetchPostNumberWithPoW, getPoWValidationData } from '../lib/pow-validation'
import { usePoWValidity } from '../hooks/use-pow-validity'
import { useAuth } from '../contexts/AuthContext'
import { MiningManager } from '../lib/mining/MiningManager'
import { invokeFunction } from '../lib/functions-utils'
import { useMining } from '../hooks/use-mining'
import { calculateThreadDifficulty, isThreadLocked, POW_PRESETS } from '../lib/pow-config'
import { createNotificationsForPost } from '../lib/notifications'

export function NewReplyPage() {
  const { boardSlug, threadId } = useParams<{ boardSlug: string; threadId: string }>()
  const [searchParams] = useSearchParams()
  const parentPostId = searchParams.get('replyTo')
  const { authState } = useAuth()
  
  const [content, setContent] = useState('')
  const [nameField, setNameField] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [thread, setThread] = useState<any>(null)
  const [board, setBoard] = useState<any>(null)
  const [parentPost, setParentPost] = useState<any>(null)
  const [initializing, setInitializing] = useState(true)
  const [clipboardImageUrl, setClipboardImageUrl] = useState<string | null>(null)
  const [targetDifficulty, setTargetDifficulty] = useState({ prefix: '21e8', points: 15 })
  const [isLocked, setIsLocked] = useState(false)
  const [cooldown, setCooldown] = useState<number>(0)
  const navigate = useNavigate()
  const hasValidPoW = usePoWValidity(targetDifficulty.prefix, targetDifficulty.points)
  const miningManagerRef = useRef(MiningManager.getInstance())
  const { dedicatedSession } = useMining()

  // Load clipboard image from localStorage
  useEffect(() => {
    const clipboardImage = localStorage.getItem('clipboard-image')
    if (clipboardImage) {
      setClipboardImageUrl(clipboardImage)
      setImagePreview(clipboardImage)
      toast.success('Using image from clipboard!', { duration: 3000 })
    }
  }, [])

  // Start dedicated mining will be triggered after thread info is loaded

  const restartMining = () => {
    console.log('[NewReplyPage] Restarting dedicated mining...', targetDifficulty)
    miningManagerRef.current.startDedicatedMining('post', undefined, targetDifficulty.points, targetDifficulty.prefix)
      .catch(err => console.error('[NewReplyPage] Mining error:', err))
  }

  useEffect(() => {
    initializePage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, boardSlug, parentPostId])

  const initializePage = async () => {
    try {
      // Get current user from auth state
      if (!authState.user) {
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

      if (fullUser.role === 'ghost') {
        toast.error('You are a ghost and cannot reply.')
        navigate('/')
        return
      }

      // Check cooldown
      const cooldownUntil = localStorage.getItem('reply_cooldown_until')
      if (cooldownUntil) {
        const remaining = parseInt(cooldownUntil) - Date.now()
        if (remaining > 0) {
          setCooldown(remaining)
          const interval = setInterval(() => {
            const r = parseInt(cooldownUntil) - Date.now()
            if (r <= 0) {
              setCooldown(0)
              clearInterval(interval)
            } else {
              setCooldown(r)
            }
          }, 1000)
        }
      }

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

      // Get thread and calculate difficulty
      if (threadId) {
        const threads = await db.db.threads.list({
          where: { id: threadId }
        })

        if (threads.length > 0) {
          const loadedThread = threads[0]
          setThread(loadedThread)

          // Fetch reply count for difficulty calculation
          const replyCount = await db.db.posts.count({
            where: { threadId: threadId }
          })
          
          // Calculate difficulty based on reply count
          const difficulty = calculateThreadDifficulty(replyCount)
          setTargetDifficulty(difficulty)
          
          // Check if thread is locked
          const locked = isThreadLocked(replyCount, loadedThread.totalPow || 0)
          setIsLocked(locked)

          if (!locked) {
            // Start mining with calculated difficulty
            console.log(`[NewReplyPage] Starting mining with difficulty: ${difficulty.prefix} (${difficulty.points} pts) for ${replyCount} replies`)
            miningManagerRef.current.startDedicatedMining('post', undefined, difficulty.points, difficulty.prefix)
              .catch(err => console.error('[NewReplyPage] Mining error:', err))
          }
        } else {
          toast.error('Thread not found')
          navigate(`/board/${boardSlug}`)
          return
        }
      }

      // Get parent post if replying to specific post
      if (parentPostId) {
        const posts = await db.db.posts.list({
          where: { id: parentPostId }
        })

        if (posts.length > 0) {
          setParentPost(posts[0])
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
      setClipboardImageUrl(null) // Clear clipboard if file is uploaded
      const reader = new FileReader()
      reader.onload = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview(null)
    setClipboardImageUrl(null)
    // Clear the file input
    const fileInput = document.getElementById('image') as HTMLInputElement
    if (fileInput) {
      fileInput.value = ''
    }
    toast.success('Image removed')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isLocked) {
      toast.error('Thread is locked due to low entropy')
      return
    }

    if (cooldown > 0) {
      toast.error(`Cooldown active: ${Math.ceil(cooldown / 1000)}s remaining`)
      return
    }

    if (!content.trim()) {
      toast.error('Content is required')
      return
    }

    // Confidence Cooldown Logic
    // Long, declarative posts impose a cooldown on the author
    const isLong = content.length > 200
    const punctuationCount = (content.match(/[.!]/g) || []).length
    const isDeclarative = punctuationCount > 5
    
    if (isLong && isDeclarative) {
      // 5 minute cooldown
      const cooldownTime = 5 * 60 * 1000
      localStorage.setItem('reply_cooldown_until', (Date.now() + cooldownTime).toString())
      toast('Taking a breath... (Confidence Cooldown Applied)', { icon: '🌬️' })
    }

    if (!thread || !board) {
      toast.error('Thread not found')
      return
    }

    setLoading(true)

    try {
      // Always use the database username - no parsing from name field
      const finalUsername = user.username || 'Anonymous'
      
      // Only parse tripcode from name field (for the tripcode part, not username)
      let tripcode = ''
      if (nameField) {
        const { password, isSecure } = parseTripcode(nameField)
        if (password) {
          tripcode = await generateTripcode(password, isSecure)
        }
      }

      // Use clipboard image or upload file
      let publicUrl = clipboardImageUrl
      if (!publicUrl && imageFile) {
        const extension = imageFile.name.split('.').pop()
        const randomId = Math.random().toString(36).substring(2, 15)
        const uploadResult = await db.storage.upload(
          imageFile,
          `posts/${Date.now()}-${randomId}.${extension}`,
          { upsert: true }
        )
        publicUrl = uploadResult.publicUrl
        
        // Save to image library
        await saveToImageLibrary(publicUrl, imageFile.name, imageFile.size, user.id)
      } else if (publicUrl) {
        // Using clipboard image - mark as used
        await saveToImageLibrary(publicUrl, 'Clipboard image', 0, user.id)
      }

      // Call edge function to get next post number with PoW validation
      let nextPostNumber: number;
      // Capture PoW data before it's consumed by fetchPostNumberWithPoW
      const powData = getPoWValidationData();
      
      try {
        console.log('Fetching post number from edge function with PoW validation...');
        nextPostNumber = await fetchPostNumberWithPoW(true);
        console.log('✓ Valid post number received with PoW validation:', nextPostNumber);
      } catch (fetchError: any) {
        console.error('Failed to fetch post number from edge function:', fetchError);
        toast.error(fetchError.message || 'Failed to get post number. Please try again.');
        throw fetchError;
      }

      // Create reply post with global post number
      const postData: any = {
        threadId: threadId,
        userId: user.id,
        username: finalUsername,
        content: content.trim(),
        postNumber: nextPostNumber,
        totalPow: 0,
        createdAt: new Date().toISOString()
      }
      
      // Only add optional fields if they have values
      if (tripcode) postData.tripcode = tripcode
      if (publicUrl) postData.imageUrl = publicUrl
      if (parentPostId) postData.parentPostId = parentPostId
      
      const newPost = await db.db.posts.create(postData)
      
      if (newPost && newPost.id) {
        await createNotificationsForPost(
           content, 
           threadId || '', 
           newPost.id, 
           user.id,
           parentPostId || undefined
        )
      }

      // Submit PoW to the thread to bump it
      if (powData) {
        console.log('Submitting PoW to bump thread:', threadId);
        // We use the same PoW that was used for post validation
        // This bumps the thread's totalPow and sorting order
        await invokeFunction('validate-pow', {
          body: {
            challenge: powData.challenge,
            nonce: powData.nonce,
            hash: powData.hash,
            points: powData.points,
            trailingZeros: powData.trailingZeros,
            prefix: powData.prefix,
            targetType: 'thread',
            targetId: threadId,
            userId: user.id
          }
        });
      }

      toast.success('Reply posted successfully!')

      // Navigate back to thread
      setTimeout(() => {
        navigate(`/board/${boardSlug}/thread/${threadId}`)
      }, 500)
    } catch (error: any) {
      toast.error(error.message || 'Failed to post reply')
      console.error('Error posting reply:', error)
    } finally {
      setLoading(false)
    }
  }

  if (initializing || !user || !thread || !board) {
    return (
      <div className="bg-white text-black min-h-screen flex items-center justify-center">
        <div className="text-center font-mono">
          <div className="text-2xl mb-2">LOADING...</div>
          <div className="text-gray-500">Verifying authentication and thread</div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white text-black min-h-screen">
      <div className="container mx-auto p-4 max-w-4xl">
        <button
          onClick={() => navigate(`/board/${boardSlug}/thread/${threadId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-black font-mono text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          BACK TO THREAD
        </button>

        <div className="border-2 border-black bg-black text-white p-2 mb-4 text-sm">
          <h1 className="font-bold font-mono">
            REPLY TO: {thread.title}
          </h1>
          {parentPost && (
            <p className="text-xs font-mono mt-1 text-gray-300">
              Replying to post #{(() => {
                const num = Number(parentPost.post_number || parentPost.postNumber || 0);
                return Number.isFinite(num) && num >= 0 ? num : 'N/A';
              })()}
            </p>
          )}
        </div>

        <Card className="border-2 border-black">
          <CardHeader className="bg-black text-white border-b-2 border-black p-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              <div>
                <CardTitle className="text-base font-mono">POST REPLY</CardTitle>
                <CardDescription className="font-mono text-xs text-gray-300 mt-1">
                  Reply to thread. Mining will begin automatically.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name" className="font-mono font-bold text-xs">
                  NAME (optional)
                </Label>
                <Input
                  id="name"
                  type="text"
                  value={nameField}
                  onChange={(e) => setNameField(e.target.value)}
                  className="font-mono mt-1 border border-black text-sm"
                  placeholder="Anonymous or Name#tripcode"
                  disabled={loading}
                />
                <p className="text-xs text-gray-600 font-mono mt-1">
                  Use #password for tripcode or ##password for secure tripcode
                </p>
              </div>

              <div>
                <Label htmlFor="image" className="font-mono font-bold text-xs">
                  IMAGE (optional)
                </Label>
                <div className="space-y-2">
                  <Input
                    id="image"
                    type="file"
                    accept={boardSlug === 'gif' ? '.gif,.webm' : 'image/*,video/webm'}
                    onChange={handleImageChange}
                    className="font-mono border border-black text-sm mt-1"
                    disabled={loading}
                  />
                  {boardSlug === 'gif' && (
                    <p className="text-xs font-mono text-red-600">
                      ⚠ This board only accepts GIF and WebM files
                    </p>
                  )}
                </div>
                {imagePreview && (
                  <div className="mt-2 border border-black p-1">
                    <div className="flex items-start justify-between gap-2">
                      <img 
                        src={imagePreview} 
                        alt="Preview" 
                        className="max-w-full max-h-48 object-contain"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="flex-shrink-0 p-1 border border-black hover:bg-red-200 transition-colors"
                        title="Remove image"
                        disabled={loading}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="content" className="font-mono font-bold text-xs">
                  COMMENT *
                </Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="font-mono mt-1 border border-black min-h-32 text-sm"
                  placeholder="Enter your reply..."
                  required
                  disabled={loading}
                />
              </div>

              <div className={`border-2 p-4 font-mono text-sm mb-4 ${
                hasValidPoW 
                  ? 'bg-green-50 border-green-600 text-green-800' 
                  : dedicatedSession 
                    ? 'bg-blue-50 border-blue-600 text-blue-800'
                    : 'bg-red-50 border-red-600 text-red-800'
              }`}>
                <p className={`font-bold mb-2 ${
                  hasValidPoW ? 'text-green-600' : dedicatedSession ? 'text-blue-600' : 'text-red-600'
                }`}>
                  ⚙ MINING STATUS
                </p>
                <div className="flex flex-col gap-2">
                  <p>
                    {hasValidPoW 
                      ? '✓ Valid PoW found! You can now post your reply.' 
                      : dedicatedSession 
                        ? `⏳ Mining in progress... Need hash starting with ${targetDifficulty.prefix} (${targetDifficulty.points} pts).`
                        : '⚠ Mining stopped. Please click "Restart Mining" to continue.'}
                  </p>
                  
                  {isLocked && (
                    <p className="text-red-600 font-bold">
                      ⛔ THREAD LOCKED. Thread needs more PoW to accept replies. 
                      Go back to thread and mine it to unlock.
                    </p>
                  )}
                  
                  {!hasValidPoW && !dedicatedSession && !isLocked && (
                    <Button 
                      type="button" 
                      onClick={restartMining}
                      variant="outline"
                      size="sm"
                      className="self-start border-red-600 text-red-600 hover:bg-red-50"
                    >
                      RESTART MINING
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  className="font-mono flex-1 bg-black text-white border border-black hover:bg-white hover:text-black text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading || !hasValidPoW || isLocked || cooldown > 0}
                  title={!hasValidPoW ? `Mining must produce PoW with hash starting with ${targetDifficulty.prefix}` : ''}
                >
                  {loading ? 'POSTING...' : isLocked ? 'THREAD LOCKED' : cooldown > 0 ? `COOLDOWN (${Math.ceil(cooldown/1000)}s)` : !hasValidPoW ? 'MINING PoW...' : 'POST'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="font-mono border border-black text-sm"
                  onClick={() => navigate(`/board/${boardSlug}/thread/${threadId}`)}
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
