import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '../ui/button'
import { Card } from '../ui/card'
import { Slider } from '../ui/slider'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { 
  Paintbrush, 
  Eraser, 
  Download,
  Image as ImageIcon,
  Users,
  Camera,
  Film,
  Trash2,
  Play,
  Square,
  Copy,
  Hash,
  Sparkles,
  Undo,
  Redo,
  Wand2,
  Upload,
  Circle,
  Star,
} from 'lucide-react'
import db from '../../lib/db-client'
import toast from 'react-hot-toast'
import type { RealtimeChannel } from '@blinkdotnew/sdk'
import { saveToImageLibrary } from '../../lib/image-library'
import { generateGIFFromFrames, exportFrameSequence } from '../../lib/gif-encoder'
import { applyDithering } from '../../lib/dither'
import { useAuth } from '../../contexts/AuthContext'

interface DrawAction {
  type: 'draw' | 'clear'
  x?: number
  y?: number
  color?: string
  size?: number
  tool?: 'brush' | 'eraser' | 'stamp'
  userId: string
  timestamp: number
}

interface CanvasFrame {
  dataUrl: string
  timestamp: number
}

export function MultiplayerCanvas() {
  const { authState } = useAuth()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const userMaskRef = useRef<HTMLCanvasElement>(null) // Track user-drawn areas
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [brushColor, setBrushColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(3)
  const [tool, setTool] = useState<'brush' | 'eraser' | 'stamp'>('brush')
  const [brushStyle, setBrushStyle] = useState<'normal' | 'spray' | 'calligraphy'>('normal')
  const [stampType, setStampType] = useState<'circle' | 'square' | 'star'>('circle')
  const [lastPosition, setLastPosition] = useState<{ x: number; y: number } | null>(null)
  const [onlineUsers, setOnlineUsers] = useState<number>(0)
  const [user, setUser] = useState<any>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [frames, setFrames] = useState<CanvasFrame[]>([])
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const [history, setHistory] = useState<ImageData[]>([])
  const [historyStep, setHistoryStep] = useState(-1)
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null)

  // Session management
  const [sessionActive, setSessionActive] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)

  // Slim canvas size - space-conscious
  const CANVAS_WIDTH = 800
  const CANVAS_HEIGHT = 400

  useEffect(() => {
    const initCanvas = async () => {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Set canvas size
      canvas.width = CANVAS_WIDTH
      canvas.height = CANVAS_HEIGHT

      // Fill with white background
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Initialize user mask canvas (offscreen)
      const maskCanvas = document.createElement('canvas')
      maskCanvas.width = CANVAS_WIDTH
      maskCanvas.height = CANVAS_HEIGHT
      userMaskRef.current = maskCanvas
      
      const maskCtx = maskCanvas.getContext('2d')
      if (maskCtx) {
        // Start with transparent mask
        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height)
      }

      // Get current user from auth state
      setUser(authState.user)
    }

    initCanvas().catch(console.error)

    // Handle page unload/navigation to clean up WebSocket connection
    const handleBeforeUnload = () => {
      cleanup()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    // Cleanup on unmount
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      cleanup()
    }
  }, [])

  const generateSessionId = () => {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  const saveHistory = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const newHistory = history.slice(0, historyStep + 1)
    newHistory.push(imageData)
    setHistory(newHistory)
    setHistoryStep(newHistory.length - 1)
  }

  const undo = () => {
    if (historyStep > 0) {
      setHistoryStep(historyStep - 1)
      restoreHistory(historyStep - 1)
    }
  }

  const redo = () => {
    if (historyStep < history.length - 1) {
      setHistoryStep(historyStep + 1)
      restoreHistory(historyStep + 1)
    }
  }

  const restoreHistory = (step: number) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const imageData = history[step]
    if (imageData) {
      ctx.putImageData(imageData, 0, 0)
    }
  }

  const applyDitheringEffect = async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const ditheredData = applyDithering(imageData)
      ctx.putImageData(ditheredData, 0, 0)
      saveHistory()
      toast.success('Dithering applied')
    } catch (error) {
      console.error('Dithering failed:', error)
      toast.error('Failed to apply dithering')
    }
  }

  const loadImageToCanvas = (imageUrl: string) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      // Clear canvas
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      // Draw image to fit canvas
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      saveHistory()
      toast.success('Image loaded as background')
    }
    img.onerror = () => {
      toast.error('Failed to load image')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      saveHistory()
    }
    img.src = imageUrl
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const imageUrl = event.target?.result as string
      setBackgroundImage(imageUrl)
      loadImageToCanvas(imageUrl)
    }
    reader.readAsDataURL(file)
  }

  const drawStamp = (x: number, y: number) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = brushColor
    ctx.strokeStyle = brushColor
    ctx.lineWidth = 2

    const size = brushSize * 3

    switch (stampType) {
      case 'circle':
        ctx.beginPath()
        ctx.arc(x, y, size, 0, Math.PI * 2)
        ctx.fill()
        break
      case 'square':
        ctx.fillRect(x - size, y - size, size * 2, size * 2)
        break
      case 'star':
        ctx.beginPath()
        for (let i = 0; i < 5; i++) {
          const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2
          const radius = i % 2 === 0 ? size : size / 2
          ctx.lineTo(x + radius * Math.cos(angle), y + radius * Math.sin(angle))
        }
        ctx.closePath()
        ctx.fill()
        break
    }
  }

  const generateAITexture = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Please enter a texture prompt')
      return
    }

    const canvas = canvasRef.current
    const maskCanvas = userMaskRef.current
    if (!canvas || !maskCanvas) return

    const ctx = canvas.getContext('2d')
    const maskCtx = maskCanvas.getContext('2d')
    if (!ctx || !maskCtx) return

    // Check if user has drawn anything
    const maskData = maskCtx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    const hasDrawing = maskData.data.some((value, index) => {
      // Check alpha channel (every 4th value)
      return index % 4 === 3 && value > 0
    })

    if (!hasDrawing) {
      toast.error('Draw something first, then apply AI textures')
      return
    }

    setAiGenerating(true)
    const loadingToastId = toast.loading('Generating AI texture...')

    try {
      // Use user-provided prompt
      const prompt = aiPrompt.trim()
      
      // Generate COLOR image using AI
      const result = await db.ai.generateImage({
        prompt: `${prompt}, rich vibrant colors, high saturation, artistic texture, 800x400 pixels`,
        n: 1
      })

      if (result.data && result.data[0]?.url) {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            // Create temporary canvas for texture
            const tempCanvas = document.createElement('canvas')
            tempCanvas.width = CANVAS_WIDTH
            tempCanvas.height = CANVAS_HEIGHT
            const tempCtx = tempCanvas.getContext('2d')
            
            if (tempCtx) {
              // Draw AI texture to temp canvas
              tempCtx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
              
              // Apply texture only to user-drawn areas using mask
              // Save current canvas state
              ctx.save()
              
              // Use mask as clipping region
              ctx.globalCompositeOperation = 'source-over'
              
              // Get the image data from both canvases
              const textureData = tempCtx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
              const canvasData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
              const maskImageData = maskCtx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
              
              // Apply texture only where mask has alpha > 0
              for (let i = 0; i < maskImageData.data.length; i += 4) {
                const maskAlpha = maskImageData.data[i + 3]
                if (maskAlpha > 0) {
                  // Copy texture color to canvas at this pixel
                  canvasData.data[i] = textureData.data[i]       // R
                  canvasData.data[i + 1] = textureData.data[i + 1] // G
                  canvasData.data[i + 2] = textureData.data[i + 2] // B
                  // Keep original alpha or use mask alpha
                  canvasData.data[i + 3] = Math.max(canvasData.data[i + 3], maskAlpha)
                }
              }
              
              // Put the modified image data back
              ctx.putImageData(canvasData, 0, 0)
              
              ctx.restore()
              
              toast.dismiss(loadingToastId)
              toast.success('Colorful AI textures applied to your drawing!')
            }
            resolve()
          }
          img.onerror = () => {
            toast.dismiss(loadingToastId)
            toast.error('Failed to load AI texture')
            reject(new Error('Image load failed'))
          }
          img.src = result.data[0].url
        })
      } else {
        throw new Error('No image generated')
      }
    } catch (error) {
      console.error('AI texture generation failed:', error)
      toast.dismiss(loadingToastId)
      toast.error('AI texture generation failed')
      
      // Fallback: generate colorful procedural pattern on user areas only
      generateFallbackPattern(ctx)
    } finally {
      setAiGenerating(false)
    }
  }

  const generateFallbackPattern = (ctx: CanvasRenderingContext2D) => {
    const maskCanvas = userMaskRef.current
    if (!maskCanvas) return
    
    const maskCtx = maskCanvas.getContext('2d')
    if (!maskCtx) return
    
    // Get mask data
    const maskData = maskCtx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    const canvasData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    
    // Apply colorful random dots only to user-drawn areas
    for (let i = 0; i < maskData.data.length; i += 4) {
      const maskAlpha = maskData.data[i + 3]
      if (maskAlpha > 0) {
        // Generate random vibrant color
        const hue = Math.random() * 360
        const sat = 70 + Math.random() * 30
        const light = 50 + Math.random() * 20
        
        // Convert HSL to RGB
        const c = (1 - Math.abs(2 * light / 100 - 1)) * sat / 100
        const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
        const m = light / 100 - c / 2
        
        let r = 0, g = 0, b = 0
        if (hue < 60) { r = c; g = x; b = 0 }
        else if (hue < 120) { r = x; g = c; b = 0 }
        else if (hue < 180) { r = 0; g = c; b = x }
        else if (hue < 240) { r = 0; g = x; b = c }
        else if (hue < 300) { r = x; g = 0; b = c }
        else { r = c; g = 0; b = x }
        
        canvasData.data[i] = Math.round((r + m) * 255)
        canvasData.data[i + 1] = Math.round((g + m) * 255)
        canvasData.data[i + 2] = Math.round((b + m) * 255)
      }
    }
    
    ctx.putImageData(canvasData, 0, 0)
    toast.success('Colorful procedural pattern applied')
  }

  const startSession = async () => {
    // Check if user is authenticated first
    if (!user) {
      toast.error('Please sign in to start a session')
      return
    }
    
    const newSessionId = generateSessionId()
    setSessionId(newSessionId)
    setSessionActive(true)
    setSessionStartTime(Date.now())
    setFrames([])
    
    // Clear the user mask for new session
    const maskCanvas = userMaskRef.current
    if (maskCanvas) {
      const maskCtx = maskCanvas.getContext('2d')
      if (maskCtx) {
        maskCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      }
    }
    
    // Don't auto-generate texture - let user draw first
    
    if (user) {
      await setupRealtimeChannel(user, newSessionId)
    }
    
    toast.success(`Session started: ${newSessionId.substring(0, 20)}...`)
  }

  const endSession = () => {
    // Clean up before marking session inactive to prevent race conditions
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current)
      frameIntervalRef.current = null
    }
    if (isRecording) {
      setIsRecording(false)
    }
    cleanup()
    
    // Mark session as inactive after cleanup to prevent reconnection attempts
    setSessionActive(false)
    setSessionStartTime(null)
    toast.success('Session ended')
  }

  const copySessionId = () => {
    if (sessionId) {
      navigator.clipboard.writeText(sessionId)
      toast.success('Session ID copied to clipboard')
    }
  }

  const setupRealtimeChannel = async (currentUser: any, sessionId: string) => {
    try {
      // Use session-scoped channel
      const channel = db.realtime.channel(`canvas-${sessionId}`)
      channelRef.current = channel

      // Subscribe to channel with user metadata
      await channel.subscribe({
        userId: currentUser.id,
        metadata: { 
          displayName: currentUser.username || currentUser.email,
          sessionId
        }
      })

      // Listen for draw actions from other users
      channel.onMessage((message) => {
        if (message.type === 'draw' && message.userId !== currentUser.id) {
          const action = message.data as DrawAction
          applyRemoteDrawAction(action)
        }
      })

      // Track online users
      channel.onPresence((users) => {
        setOnlineUsers(users.length)
      })

      toast.success('Connected to session canvas')
    } catch (error) {
      console.error('Failed to setup realtime:', error)
      
      // Log detailed error information for debugging
      if (error instanceof Error) {
        console.error('Error name:', error.name)
        console.error('Error message:', error.message)
        console.error('Error stack:', error.stack)
      }
      
      // Check for WebSocket-specific errors
      const wsError = error as any
      if (wsError?.target) {
        console.error('WebSocket error details:')
        console.error('- URL:', wsError.target.url || 'unknown')
        console.error('- ReadyState:', wsError.target.readyState || 'unknown')
        console.error('- Protocol:', wsError.target.protocol || 'unknown')
      }
      
      // Provide user-friendly error message
      if (error instanceof Error && error.message.includes('auth')) {
        toast.error('Authentication required. Please sign in again.')
      } else if (error instanceof Error && error.message.includes('network')) {
        toast.error('Network error. Check your connection and retry.')
      } else {
        toast.error('Failed to connect. Please try again.')
      }
      
      // Clean up failed connection
      if (channelRef.current) {
        try {
          channelRef.current.unsubscribe()
        } catch (cleanupError) {
          console.error('Cleanup error:', cleanupError)
        }
        channelRef.current = null
      }
    }
  }

  const cleanup = () => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current)
      frameIntervalRef.current = null
    }
    if (channelRef.current) {
      try {
        channelRef.current.unsubscribe()
      } catch (error) {
        console.error('Error during channel cleanup:', error)
      } finally {
        channelRef.current = null
      }
    }
  }

  const applyRemoteDrawAction = (action: DrawAction) => {
    const canvas = canvasRef.current
    const maskCanvas = userMaskRef.current
    if (!canvas || !maskCanvas) return

    const ctx = canvas.getContext('2d')
    const maskCtx = maskCanvas.getContext('2d')
    if (!ctx || !maskCtx) return

    if (action.type === 'clear') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      // Also clear mask
      maskCtx.clearRect(0, 0, canvas.width, canvas.height)
      return
    }

    if (action.x !== undefined && action.y !== undefined) {
      // Draw on main canvas
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = action.size || 3

      if (action.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out'
      } else {
        ctx.globalCompositeOperation = 'source-over'
        ctx.strokeStyle = action.color || '#000000'
      }

      ctx.beginPath()
      ctx.arc(action.x, action.y, (action.size || 3) / 2, 0, Math.PI * 2)
      ctx.fill()
      
      // Also update mask
      maskCtx.lineCap = 'round'
      maskCtx.lineJoin = 'round'
      maskCtx.lineWidth = action.size || 3
      
      if (action.tool === 'eraser') {
        maskCtx.globalCompositeOperation = 'destination-out'
      } else {
        maskCtx.globalCompositeOperation = 'source-over'
        maskCtx.fillStyle = '#000000'
      }
      
      maskCtx.beginPath()
      maskCtx.arc(action.x, action.y, (action.size || 3) / 2, 0, Math.PI * 2)
      maskCtx.fill()
    }
  }

  const broadcastDrawAction = async (action: Omit<DrawAction, 'userId' | 'timestamp'>) => {
    if (!channelRef.current || !user) return

    const fullAction: DrawAction = {
      ...action,
      userId: user.id,
      timestamp: Date.now()
    }

    try {
      await channelRef.current.publish('draw', fullAction)
    } catch (error) {
      console.error('Failed to broadcast draw action:', error)
    }
  }

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    if ('touches' in e && e.touches.length > 0) {
      const touch = e.touches[0]
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
      }
    } else if ('clientX' in e) {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      }
    }
    return null
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!sessionActive) return
    e.preventDefault()
    const point = getCanvasPoint(e)
    if (!point) return

    setIsDrawing(true)
    setLastPosition(point)
    draw(point.x, point.y, true)
  }

  const draw = (x: number, y: number, isStart: boolean = false) => {
    const canvas = canvasRef.current
    const maskCanvas = userMaskRef.current
    if (!canvas || !maskCanvas) return

    const ctx = canvas.getContext('2d')
    const maskCtx = maskCanvas.getContext('2d')
    if (!ctx || !maskCtx) return

    if (tool === 'stamp') {
      drawStamp(x, y)
      broadcastDrawAction({
        type: 'draw',
        x,
        y,
        color: brushColor,
        size: brushSize,
        tool: 'stamp'
      })
      return
    }

    // Draw on main canvas
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = brushSize

    if (tool === 'brush') {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = brushColor

      // Apply brush style
      if (brushStyle === 'spray') {
        // Spray paint effect
        for (let i = 0; i < 10; i++) {
          const offsetX = (Math.random() - 0.5) * brushSize * 2
          const offsetY = (Math.random() - 0.5) * brushSize * 2
          ctx.fillStyle = brushColor
          ctx.fillRect(x + offsetX, y + offsetY, 2, 2)
        }
        // Update mask for spray
        for (let i = 0; i < 10; i++) {
          const offsetX = (Math.random() - 0.5) * brushSize * 2
          const offsetY = (Math.random() - 0.5) * brushSize * 2
          maskCtx.fillStyle = '#000000'
          maskCtx.fillRect(x + offsetX, y + offsetY, 2, 2)
        }
        broadcastDrawAction({
          type: 'draw',
          x,
          y,
          color: brushColor,
          size: brushSize,
          tool: 'brush'
        })
        return
      } else if (brushStyle === 'calligraphy') {
        // Calligraphy effect (variable width)
        ctx.lineWidth = brushSize * (0.5 + Math.random())
      }
    } else {
      ctx.globalCompositeOperation = 'destination-out'
    }

    if (isStart) {
      ctx.beginPath()
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.lineTo(x, y)
      ctx.stroke()
    }

    // Also update mask canvas to track user-drawn areas
    maskCtx.lineCap = 'round'
    maskCtx.lineJoin = 'round'
    maskCtx.lineWidth = brushSize

    if (tool === 'brush') {
      maskCtx.globalCompositeOperation = 'source-over'
      maskCtx.fillStyle = '#000000' // Just track the area
      
      if (isStart) {
        maskCtx.beginPath()
        maskCtx.arc(x, y, brushSize / 2, 0, Math.PI * 2)
        maskCtx.fill()
      } else {
        maskCtx.strokeStyle = '#000000'
        maskCtx.lineTo(x, y)
        maskCtx.stroke()
      }
    } else {
      // Eraser also erases from mask
      maskCtx.globalCompositeOperation = 'destination-out'
      
      if (isStart) {
        maskCtx.beginPath()
        maskCtx.arc(x, y, brushSize / 2, 0, Math.PI * 2)
        maskCtx.fill()
      } else {
        maskCtx.lineTo(x, y)
        maskCtx.stroke()
      }
    }

    // Broadcast to other users
    broadcastDrawAction({
      type: 'draw',
      x,
      y,
      color: brushColor,
      size: brushSize,
      tool
    })
  }

  const onMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    e.preventDefault()

    const point = getCanvasPoint(e)
    if (!point) return

    if (lastPosition) {
      const steps = Math.max(Math.abs(point.x - lastPosition.x), Math.abs(point.y - lastPosition.y))
      for (let i = 0; i <= steps; i++) {
        const t = i / steps
        const x = lastPosition.x + (point.x - lastPosition.x) * t
        const y = lastPosition.y + (point.y - lastPosition.y) * t
        draw(x, y, i === 0)
      }
    } else {
      draw(point.x, point.y)
    }

    setLastPosition(point)
  }

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false)
      setLastPosition(null)
    }
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const maskCanvas = userMaskRef.current
    if (!canvas || !maskCanvas) return

    const ctx = canvas.getContext('2d')
    const maskCtx = maskCanvas.getContext('2d')
    if (!ctx || !maskCtx) return

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // Also clear mask
    maskCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Broadcast clear action
    broadcastDrawAction({ type: 'clear' })
    
    toast.success('Canvas cleared')
  }

  const captureFrame = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dataUrl = canvas.toDataURL('image/png')
    setFrames(prev => [...prev, { dataUrl, timestamp: Date.now() }])
  }, [])

  const startRecording = () => {
    if (!sessionActive) {
      toast.error('Start a session first')
      return
    }
    setIsRecording(true)
    setFrames([])
    
    // Capture initial frame
    captureFrame()
    
    // Capture frame every 100ms
    frameIntervalRef.current = setInterval(captureFrame, 100)
    
    toast.success('Recording started')
  }

  const stopRecording = () => {
    setIsRecording(false)
    
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current)
      frameIntervalRef.current = null
    }
    
    toast.success(`Recording stopped. ${frames.length} frames captured`)
  }

  const saveSnapshot = async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    try {
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/png')
      })

      if (!user) {
        toast.error('Please sign in first')
        return
      }

      const filename = `canvas-snapshot-${Date.now()}.png`
      const { publicUrl } = await db.storage.upload(blob as File, `canvas/${user.id}/${filename}`, {
        upsert: true
      })
      
      // Save to image library
      await saveToImageLibrary(publicUrl, filename, blob.size, user.id)

      toast.success('Snapshot saved to library')
    } catch (error) {
      console.error('Failed to save snapshot:', error)
      toast.error('Failed to save snapshot')
    }
  }

  const exportAsGIF = async () => {
    if (frames.length < 2) {
      toast.error('Need at least 2 frames to create GIF')
      return
    }

    if (!user) {
      toast.error('Please sign in first')
      return
    }

    setIsExporting(true)
    const loadingToast = toast.loading('Generating animated GIF...')

    try {
      // Generate GIF from frames
      const gifBlob = await generateGIFFromFrames({
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        frames: frames.map(f => f.dataUrl),
        delay: 100,
        quality: 10
      })

      toast.dismiss(loadingToast)
      toast.loading('Uploading GIF to storage...')

      const filename = `canvas-session-${sessionId?.substring(0, 12)}-${Date.now()}.gif`
      const { publicUrl } = await db.storage.upload(gifBlob as File, `canvas/${user.id}/${filename}`, {
        upsert: true
      })
      
      // Save to image library
      await saveToImageLibrary(publicUrl, filename, gifBlob.size, user.id)

      toast.dismiss()
      toast.success(`Animated GIF exported with ${frames.length} frames`)
      
      // Clear frames
      setFrames([])
    } catch (error) {
      console.error('Failed to generate GIF:', error)
      toast.dismiss(loadingToast)
      
      // Fallback: export as frame sequence JSON
      try {
        toast.loading('Exporting as frame sequence (fallback)...')
        const sequenceBlob = exportFrameSequence(frames.map(f => f.dataUrl))
        const filename = `canvas-session-${sessionId?.substring(0, 12)}-${Date.now()}.json`
        const { publicUrl } = await db.storage.upload(sequenceBlob as File, `canvas/${user.id}/${filename}`, {
          upsert: true
        })
        
        await saveToImageLibrary(publicUrl, filename, sequenceBlob.size, user.id)
        
        toast.dismiss()
        toast.success(`Frame sequence exported with ${frames.length} frames`)
        setFrames([])
      } catch (fallbackError) {
        console.error('Fallback export also failed:', fallbackError)
        toast.error('Failed to export. Please try again.')
      }
    } finally {
      setIsExporting(false)
    }
  }

  const downloadCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `canvas-${sessionId || Date.now()}.png`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Canvas downloaded')
    })
  }

  return (
    <Card className="border-2 border-foreground p-3">
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-mono font-bold text-sm flex items-center gap-2">
            <Paintbrush className="w-4 h-4" />
            MULTIPLAYER CANVAS
          </h3>
          <div className="flex items-center gap-2 text-xs font-mono">
            <Users className="w-3 h-3" />
            <span>{onlineUsers} online</span>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground font-mono">
          Collaborative drawing • Session-scoped • Record & export as GIF
        </p>
      </div>

      {/* Session Management */}
      <div className="mb-3 p-2 border border-foreground bg-muted space-y-2">
        <div className="flex items-center gap-2 text-xs font-mono">
          <Hash className="w-3 h-3" />
          <span className="font-bold">SESSION</span>
        </div>
        
        {!sessionActive ? (
          <Button
            size="sm"
            onClick={startSession}
            className="w-full font-mono text-xs h-6"
            variant="default"
          >
            <Play className="w-3 h-3 mr-1" />
            START SESSION
          </Button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 p-1.5 bg-background border border-foreground">
              <span className="text-[9px] font-mono truncate flex-1">
                {sessionId}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={copySessionId}
                className="h-5 w-5 p-0"
              >
                <Copy className="w-2.5 h-2.5" />
              </Button>
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={endSession}
                className="flex-1 font-mono text-xs h-6 text-red-600"
              >
                <Square className="w-3 h-3 mr-1" />
                END SESSION
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Toolbar */}
      {sessionActive && (
      <div className="mb-3 flex flex-wrap items-center gap-2 p-2 border-2 border-foreground bg-background">
        {/* Tool selection */}
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={tool === 'brush' ? 'default' : 'outline'}
            onClick={() => setTool('brush')}
            className="font-mono text-xs p-1 h-7"
            title="Brush"
            disabled={!sessionActive}
          >
            <Paintbrush className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant={tool === 'eraser' ? 'default' : 'outline'}
            onClick={() => setTool('eraser')}
            className="font-mono text-xs p-1 h-7"
            title="Eraser"
            disabled={!sessionActive}
          >
            <Eraser className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant={tool === 'stamp' ? 'default' : 'outline'}
            onClick={() => setTool('stamp')}
            className="font-mono text-xs p-1 h-7"
            title="Stamp"
            disabled={!sessionActive}
          >
            <Star className="w-3 h-3" />
          </Button>
        </div>

        {/* Brush style for normal brush */}
        {tool === 'brush' && (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={brushStyle === 'normal' ? 'default' : 'outline'}
              onClick={() => setBrushStyle('normal')}
              className="font-mono text-[10px] p-1 h-7"
              title="Normal"
              disabled={!sessionActive}
            >
              Normal
            </Button>
            <Button
              size="sm"
              variant={brushStyle === 'spray' ? 'default' : 'outline'}
              onClick={() => setBrushStyle('spray')}
              className="font-mono text-[10px] p-1 h-7"
              title="Spray"
              disabled={!sessionActive}
            >
              Spray
            </Button>
            <Button
              size="sm"
              variant={brushStyle === 'calligraphy' ? 'default' : 'outline'}
              onClick={() => setBrushStyle('calligraphy')}
              className="font-mono text-[10px] p-1 h-7"
              title="Calligraphy"
              disabled={!sessionActive}
            >
              Calli
            </Button>
          </div>
        )}

        {/* Stamp type selection */}
        {tool === 'stamp' && (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={stampType === 'circle' ? 'default' : 'outline'}
              onClick={() => setStampType('circle')}
              className="font-mono text-xs p-1 h-7"
              title="Circle"
              disabled={!sessionActive}
            >
              <Circle className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant={stampType === 'square' ? 'default' : 'outline'}
              onClick={() => setStampType('square')}
              className="font-mono text-xs p-1 h-7"
              title="Square"
              disabled={!sessionActive}
            >
              <Square className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant={stampType === 'star' ? 'default' : 'outline'}
              onClick={() => setStampType('star')}
              className="font-mono text-xs p-1 h-7"
              title="Star"
              disabled={!sessionActive}
            >
              <Star className="w-3 h-3" />
            </Button>
          </div>
        )}

        {/* Image upload */}
        <div className="flex gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="font-mono text-xs p-1 h-7"
            title="Load image as background"
            disabled={!sessionActive}
          >
            <Upload className="w-3 h-3" />
          </Button>
        </div>

        {/* Color picker */}
        {tool === 'brush' && (
          <div className="flex items-center gap-1">
            <Input
              type="color"
              value={brushColor}
              onChange={(e) => setBrushColor(e.target.value)}
              className="w-7 h-7 p-0.5 cursor-pointer"
              title="Pick color"
              disabled={!sessionActive}
            />
            <Input
              type="text"
              value={brushColor}
              onChange={(e) => setBrushColor(e.target.value)}
              className="w-14 h-7 font-mono text-[10px]"
              disabled={!sessionActive}
            />
          </div>
        )}

        {/* Brush size */}
        <div className="flex items-center gap-1">
          <Slider
            value={[brushSize]}
            onValueChange={(v) => setBrushSize(v[0])}
            min={1}
            max={20}
            step={1}
            className="w-16"
            disabled={!sessionActive}
          />
          <span className="text-[10px] font-mono w-4">{brushSize}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-1 md:ml-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={undo}
            disabled={historyStep <= 0 || !sessionActive}
            className="font-mono text-xs p-1 h-7"
            title="Undo"
          >
            <Undo className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={redo}
            disabled={historyStep >= history.length - 1 || !sessionActive}
            className="font-mono text-xs p-1 h-7"
            title="Redo"
          >
            <Redo className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={applyDitheringEffect}
            className="font-mono text-xs p-1 h-7"
            title="Apply dithering effect"
            disabled={!sessionActive}
          >
            <Wand2 className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={clearCanvas}
            className="font-mono text-xs p-1 h-7"
            title="Clear canvas"
            disabled={!sessionActive}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
      )}

      {/* Canvas - Slim aspect ratio */}
      <div className="mb-3 border-2 border-foreground bg-card">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={onMove}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={onMove}
          onTouchEnd={stopDrawing}
          className={`w-full h-auto block ${sessionActive ? 'cursor-crosshair' : 'cursor-not-allowed opacity-50'}`}
          style={{ touchAction: 'none', maxWidth: '100%', display: 'block' }}
        />
      </div>

      {/* Action Buttons - Compact */}
      {sessionActive && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={showAiPanel ? 'default' : 'outline'}
              onClick={() => setShowAiPanel(!showAiPanel)}
              className="flex-1 font-mono text-xs p-1.5"
              disabled={!sessionActive}
            >
              <Sparkles className="w-3 h-3 mr-1" />
              {showAiPanel ? 'Hide AI' : 'AI Textures'}
            </Button>
          </div>
          
          {showAiPanel && (
            <div className="border-2 border-foreground p-2 space-y-2 bg-muted">
              <Label className="font-mono text-[10px] block">
                TEXTURE PROMPT
              </Label>
              <Input
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Watercolor splashes, abstract patterns, cosmic nebula..."
                className="font-mono text-xs p-1.5"
                disabled={aiGenerating}
              />
              <p className="text-[9px] text-muted-foreground font-mono">
                Describe the texture. Click APPLY multiple times for refinement!
              </p>
              <Button
                size="sm"
                className="w-full font-mono text-xs p-1.5"
                onClick={generateAITexture}
                disabled={aiGenerating || !aiPrompt.trim() || !sessionActive}
              >
                <Sparkles className="w-3 h-3 mr-1" />
                {aiGenerating ? 'APPLYING...' : 'APPLY TEXTURE'}
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={isRecording ? stopRecording : startRecording}
              className="flex-1 font-mono text-xs p-1.5"
              disabled={!sessionActive}
            >
              <Film className="w-3 h-3 mr-1" />
              {isRecording ? `Stop (${frames.length})` : 'Record'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={saveSnapshot}
              className="flex-1 font-mono text-xs p-1.5"
              disabled={!sessionActive}
            >
              <Camera className="w-3 h-3 mr-1" />
              Snapshot
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={exportAsGIF}
              disabled={frames.length < 2 || isExporting || !sessionActive}
              className="flex-1 font-mono text-xs p-1.5"
            >
              <ImageIcon className="w-3 h-3 mr-1" />
              {isExporting ? 'Export...' : 'GIF'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={downloadCanvas}
              className="font-mono text-xs p-1.5"
              disabled={!sessionActive}
            >
              <Download className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}

      {isRecording && sessionActive && (
        <div className="mt-2 text-center">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-red-600 animate-pulse">
            <div className="w-2 h-2 rounded-full bg-red-600" />
            RECORDING • {frames.length} frames
          </div>
        </div>
      )}

      {!sessionActive && (
        <div className="text-center text-xs font-mono text-muted-foreground py-4">
          Start a session to begin drawing
        </div>
      )}
    </Card>
  )
}
