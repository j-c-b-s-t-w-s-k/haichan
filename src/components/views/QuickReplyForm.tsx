import { useState, useRef, useEffect } from 'react'
import { X, Minimize2, Maximize2, Image as ImageIcon, Send, Loader2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'
import { Input } from '../ui/input'
import { Card } from '../ui/card'
import { Label } from '../ui/label'
import { parseTripcode, generateTripcode } from '../../lib/tripcode'
import { isValidImageForBoard, getImageValidationError } from '../../lib/image-validation'
import { saveToImageLibrary } from '../../lib/image-library'
import { fetchPostNumberWithPoW, getPoWValidationData } from '../../lib/pow-validation'
import { usePoWValidity } from '../../hooks/use-pow-validity'
import { useMining } from '../../hooks/use-mining'
import { MiningManager } from '../../lib/mining/MiningManager'
import { invokeFunction } from '../../lib/functions-utils'
import { calculateThreadDifficulty, isThreadLocked } from '../../lib/pow-config'
import db from '../../lib/db-client'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { createNotificationsForPost } from '../../lib/notifications'

interface QuickReplyFormProps {
  boardSlug: string
  threadId: string
  replyTo?: string
  onClose?: () => void
  onSuccess?: () => void
  minimized?: boolean
}

export function QuickReplyForm({ boardSlug, threadId, replyTo, onClose, onSuccess, minimized: initialMinimized = false }: QuickReplyFormProps) {
  const [minimized, setMinimized] = useState(initialMinimized)
  const [content, setContent] = useState('')
  const [nameField, setNameField] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { authState } = useAuth()
  
  // Mining state
  const [targetDifficulty, setTargetDifficulty] = useState({ prefix: '21e8', points: 15 })
  const hasValidPoW = usePoWValidity(targetDifficulty.prefix, targetDifficulty.points)
  const { dedicatedSession } = useMining()
  const miningManagerRef = useRef(MiningManager.getInstance())
  
  // Initialize
  useEffect(() => {
    // If replyTo is provided, append it to content
    if (replyTo) {
      setContent(prev => {
        const prefix = `>>${replyTo}\n`
        return prev.startsWith(prefix) ? prev : prefix + prev
      })
      // Open if minimized
      if (minimized) setMinimized(false)
    }
  }, [replyTo])

  useEffect(() => {
    // Determine difficulty
    const initMining = async () => {
       try {
         const replyCount = await db.db.posts.count({ where: { threadId } })
         const difficulty = calculateThreadDifficulty(replyCount)
         setTargetDifficulty(difficulty)
         
         // Auto-start mining if open
         if (!minimized && !hasValidPoW && !dedicatedSession) {
            miningManagerRef.current.startDedicatedMining('post', undefined, difficulty.points, difficulty.prefix)
              .catch(console.error)
         }
       } catch (e) {
         console.error(e)
       }
    }
    initMining()
  }, [threadId, minimized, hasValidPoW, dedicatedSession])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!isValidImageForBoard(file, boardSlug)) {
        toast.error(getImageValidationError(boardSlug))
        return
      }
      setImageFile(file)
      const reader = new FileReader()
      reader.onload = () => setImagePreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    if (!authState.user) {
      toast.error('Login required')
      return
    }

    setLoading(true)
    try {
      const user = authState.user
      const finalUsername = user.username || 'Anonymous'
      
      let tripcode = ''
      if (nameField) {
        const { password, isSecure } = parseTripcode(nameField)
        if (password) {
          tripcode = await generateTripcode(password, isSecure)
        }
      }

      let publicUrl = null
      if (imageFile) {
        const extension = imageFile.name.split('.').pop()
        const randomId = Math.random().toString(36).substring(2, 15)
        const uploadResult = await db.storage.upload(
          imageFile,
          `posts/${Date.now()}-${randomId}.${extension}`,
          { upsert: true }
        )
        publicUrl = uploadResult.publicUrl
        await saveToImageLibrary(publicUrl, imageFile.name, imageFile.size, user.id)
      }

      // Get post number with PoW
      const nextPostNumber = await fetchPostNumberWithPoW(true)
      const powData = getPoWValidationData()

      const postData: any = {
        threadId,
        userId: user.id,
        username: finalUsername,
        content: content.trim(),
        postNumber: nextPostNumber,
        totalPow: 0,
        createdAt: new Date().toISOString()
      }

      if (tripcode) postData.tripcode = tripcode
      if (publicUrl) postData.imageUrl = publicUrl
      
      const newPost = await db.db.posts.create(postData)

      // Create notifications
      // We pass the new post ID (from SDK result usually, or just assume success if void)
      // The SDK create usually returns the object. 
      // If db-client.ts wrapper returns void, we might not have the ID.
      // Let's check db-client.ts or assume it returns the created object. 
      // Blink SDK `create` usually returns the object.
      
      if (newPost && newPost.id) {
        // Find the parent post ID if replyTo was a post number
        // Actually replyTo prop is usually the Post Number string in this form logic
        // But createNotificationsForPost handles number parsing from content.
        // If replyTo is an ID, we pass it. If it's a number, we let content parser handle it.
        // In ThreadDetailPage, we setReplyTo with postNumber.toString().
        // So we don't have the parent UUID easily here unless we look it up.
        // But createNotificationsForPost handles content parsing which covers >>123.
        // The replyTo prop helps pre-fill content.
        
        await createNotificationsForPost(
           content, 
           threadId, 
           newPost.id, 
           user.id,
           undefined // We rely on content parsing for now
        )
      } else {
        // Fallback if create doesn't return ID (it should)
         console.warn('Post created but no ID returned, notifications might be skipped')
      }

      if (powData) {
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
        })
      }

      toast.success('Reply posted')
      setContent('')
      setImageFile(null)
      setImagePreview(null)
      onSuccess?.()
      
      // Stop mining after success
      miningManagerRef.current.stopDedicatedMining()
      
    } catch (error: any) {
      toast.error(error.message || 'Failed to post')
    } finally {
      setLoading(false)
    }
  }

  if (minimized) {
    return (
      <div className="fixed bottom-0 right-0 p-4 z-50">
        <Button 
          onClick={() => setMinimized(false)}
          className="shadow-xl bg-deep-teal text-white border-2 border-gunmetal font-mono hover:bg-celadon hover:text-gunmetal"
        >
          <Maximize2 className="w-4 h-4 mr-2" />
          Quick Reply
        </Button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-0 right-0 p-4 z-50 w-full max-w-md">
      <Card className="border-2 border-gunmetal shadow-2xl bg-celadon">
        <div className="flex items-center justify-between bg-deep-teal text-white p-2 border-b border-gunmetal cursor-move handle">
          <span className="font-mono font-bold text-xs">Quick Reply</span>
          <div className="flex gap-1">
            <button onClick={() => setMinimized(true)} className="hover:text-celadon"><Minimize2 className="w-4 h-4" /></button>
            <button onClick={onClose} className="hover:text-celadon"><X className="w-4 h-4" /></button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-3 space-y-3">
          <div className="flex gap-2">
            <Input 
              placeholder="Name#trip" 
              value={nameField} 
              onChange={e => setNameField(e.target.value)}
              className="font-mono text-xs h-8 bg-white border-gunmetal"
            />
          </div>
          
          <Textarea 
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Comment"
            className="font-mono text-sm min-h-[100px] bg-white border-gunmetal resize-none"
          />

          <div className="flex items-center gap-2">
             <Label htmlFor="qr-image" className="cursor-pointer border border-gunmetal p-1 bg-white hover:bg-gray-50">
               <ImageIcon className="w-4 h-4" />
             </Label>
             <Input 
               id="qr-image" 
               type="file" 
               className="hidden" 
               onChange={handleImageChange}
             />
             {imagePreview && (
               <div className="relative">
                 <img src={imagePreview} className="h-8 w-8 object-cover border border-gunmetal" />
                 <button 
                   type="button"
                   onClick={() => { setImageFile(null); setImagePreview(null); }}
                   className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"
                 >
                   <X className="w-3 h-3" />
                 </button>
               </div>
             )}
             
             <div className="ml-auto flex items-center gap-2">
               <div className={`text-[10px] font-mono px-2 py-1 border ${
                 hasValidPoW ? 'bg-green-100 text-green-800 border-green-500' : 'bg-yellow-100 text-yellow-800 border-yellow-500'
               }`}>
                 {hasValidPoW ? 'POW READY' : dedicatedSession ? 'MINING...' : 'WAITING'}
               </div>
               
               <Button 
                 type="submit" 
                 disabled={loading || !hasValidPoW}
                 size="sm"
                 className="h-8 font-mono bg-gunmetal text-celadon hover:bg-deep-teal"
               >
                 {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post'}
               </Button>
             </div>
          </div>
        </form>
      </Card>
    </div>
  )
}
