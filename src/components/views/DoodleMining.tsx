import { useState, useRef, useEffect } from 'react'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { Input } from '../ui/input'
import { Slider } from '../ui/slider'
import { Card } from '../ui/card'
import { 
  Paintbrush, 
  Eraser, 
  Palette, 
  Sparkles, 
  Download, 
  Trash2, 
  Undo, 
  Redo,
  Wand2,
  ImageIcon,
  Upload,
  Image as ImageIconLucide,
  ChevronDown,
  ChevronUp,
  Circle,
  Square,
  Star
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import db from '../../lib/db-client'
import toast from 'react-hot-toast'
import { applyDithering } from '../../lib/dither'
import { saveToImageLibrary } from '../../lib/image-library'

interface DoodleMiningProps {
  onImageGenerated?: (imageUrl: string) => void
  showMining?: boolean
  initialImage?: string // Allow starting with an image
}

export function DoodleMining({ onImageGenerated, showMining = true, initialImage }: DoodleMiningProps) {
  const { authState } = useAuth()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [brushColor, setBrushColor] = useState('#ff6464')
  const [brushSize, setBrushSize] = useState(5)
  const [tool, setTool] = useState<'brush' | 'eraser' | 'stamp'>('brush')
  const [brushStyle, setBrushStyle] = useState<'normal' | 'spray' | 'calligraphy'>('normal')
  const [stampType, setStampType] = useState<'circle' | 'square' | 'star'>('circle')
  const [history, setHistory] = useState<ImageData[]>([])
  const [historyStep, setHistoryStep] = useState(-1)
  const [generating, setGenerating] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [backgroundImage, setBackgroundImage] = useState<string | null>(initialImage || null)
  const [lastPosition, setLastPosition] = useState<{ x: number; y: number } | null>(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [showToolbar, setShowToolbar] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  // Calculate optimal canvas size based on viewport (2x scaled)
  const getCanvasSize = () => {
    const isSmallMobile = window.innerWidth < 400
    const isMediumMobile = window.innerWidth < 768
    
    if (isSmallMobile) {
      // Extra small devices (320px-399px) - 2x scale: 640x480
      return { width: 640, height: 480 }
    } else if (isMediumMobile) {
      // Mobile devices (400px-767px) - 2x scale: 1200x900
      const maxWidth = Math.min(window.innerWidth - 32, 1200)
      return { width: maxWidth, height: Math.round(maxWidth * 0.75) }
    } else {
      // Tablet/Desktop - 2x scale: 1600x1200
      return { width: 1600, height: 1200 }
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Update mobile state
    const updateMobileState = () => {
      setIsMobile(window.innerWidth < 768)
    }

    // Set canvas size based on viewport
    const size = getCanvasSize()
    canvas.width = size.width
    canvas.height = size.height

    // Fill with white background or load initial image
    if (initialImage && !backgroundImage) {
      // Load initial image passed from parent (e.g., uploaded file)
      setBackgroundImage(initialImage)
      loadImageToCanvas(initialImage)
    } else if (backgroundImage) {
      loadImageToCanvas(backgroundImage)
    } else {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      saveHistory()
    }

    // Handle window resize with debounce
    let resizeTimer: NodeJS.Timeout
    const handleResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        updateMobileState()
        
        const newSize = getCanvasSize()
        if (canvas.width !== newSize.width || canvas.height !== newSize.height) {
          // Save current state before resize
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const tempCanvas = document.createElement('canvas')
          tempCanvas.width = canvas.width
          tempCanvas.height = canvas.height
          const tempCtx = tempCanvas.getContext('2d')
          if (tempCtx) {
            tempCtx.putImageData(imageData, 0, 0)
            
            // Resize canvas
            canvas.width = newSize.width
            canvas.height = newSize.height
            
            // Restore content scaled
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height)
          }
        }
      }, 250)
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(resizeTimer)
    }
  }, [initialImage])

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

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    if ('touches' in e && e.touches.length > 0) {
      // Touch event
      const touch = e.touches[0]
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
      }
    } else if ('clientX' in e) {
      // Mouse event
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      }
    }
    return null
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const point = getCanvasPoint(e)
    if (!point) return

    setIsDrawing(true)
    setLastPosition(point)
    draw(point.x, point.y, true)
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

  const draw = (x: number, y: number, isStart: boolean = false) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (tool === 'stamp') {
      drawStamp(x, y)
      return
    }

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
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
      ctx.stroke()
    }
  }

  const onMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    e.preventDefault()

    const point = getCanvasPoint(e)
    if (!point) return

    // For smoother lines on touch devices
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
      saveHistory()
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'b' || e.key === 'B') {
        setTool('brush')
        e.preventDefault()
      } else if (e.key === 'e' || e.key === 'E') {
        setTool('eraser')
        e.preventDefault()
      } else if (e.key === 's' || e.key === 'S') {
        setTool('stamp')
        e.preventDefault()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    saveHistory()
    toast.success('Canvas cleared')
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

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Please enter a prompt')
      return
    }

    setGenerating(true)
    let loadingToast: string | undefined

    try {
      const canvas = canvasRef.current
      if (!canvas) return

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/png')
      })

      // Upload to storage
      const user = authState.user
      if (!user) {
        toast.error('Please sign in first')
        return
      }

      const randomId = Math.random().toString(36).substring(2, 15)
      const filename = `doodles/${user.id}/${Date.now()}-${randomId}.png`
      const { publicUrl } = await db.storage.upload(blob as File, filename, {
        upsert: true
      })
      
      // Save original doodle to library (silently)
      await saveToImageLibrary(publicUrl, `Doodle ${Date.now()}.png`, blob.size, user.id)

      // Generate AI-enhanced version
      loadingToast = toast.loading('AI is enhancing your doodle...')
      
      // Hack: Append #.png to ensure URL ends with extension for SDK validation
      // This is needed if the storage URL contains query parameters (e.g. Firebase tokens)
      // or if the URL doesn't have an extension
      const hasExtension = /\.(jpg|jpeg|png|gif|webp)$/i.test(publicUrl)
      const validUrl = hasExtension ? publicUrl : `${publicUrl}#.png`

      const { data } = await db.ai.modifyImage({
        images: [validUrl],
        prompt: aiPrompt.trim(),
        n: 1
      })

      if (data && data.length > 0) {
        const enhancedUrl = data[0].url
        
        // Save enhanced version to library (silently)
        await saveToImageLibrary(enhancedUrl, `AI Enhanced Doodle ${Date.now()}.png`, 0, user.id)
        
        // Load enhanced image onto canvas (iteratively)
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          const ctx = canvas.getContext('2d')
          if (!ctx) return

          // Clear canvas and draw enhanced image
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          saveHistory()
          
          if (loadingToast) toast.dismiss(loadingToast)
          toast.success('Enhancement complete! Continue editing or enhance again.')
        }
        img.onerror = () => {
          if (loadingToast) toast.dismiss(loadingToast)
          toast.error('Failed to load enhanced image')
        }
        img.src = enhancedUrl
      } else {
        if (loadingToast) toast.dismiss(loadingToast)
        toast.error('No enhancement generated')
      }
    } catch (error: any) {
      if (loadingToast) toast.dismiss(loadingToast)
      console.error('AI generation failed:', error)
      toast.error(error.message || 'Failed to generate with AI')
    } finally {
      setGenerating(false)
    }
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

  const downloadCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `doodle-${Date.now()}.png`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Doodle downloaded')
    })
  }

  const exportToThread = async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    try {
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/png')
      })

      const user = authState.user
      if (!user) {
        toast.error('Please sign in first')
        return
      }

      const randomId = Math.random().toString(36).substring(2, 15)
      const filename = `doodles/${user.id}/${Date.now()}-${randomId}.png`
      const { publicUrl } = await db.storage.upload(blob as File, filename, {
        upsert: true
      })
      
      // Save to image library (silently)
      await saveToImageLibrary(publicUrl, `Doodle ${Date.now()}.png`, blob.size, user.id)

      if (onImageGenerated) {
        onImageGenerated(publicUrl)
      }

      toast.success('Doodle ready!')
    } catch (error) {
      console.error('Export failed:', error)
      toast.error('Failed to export doodle')
    }
  }

  return (
    <Card className="border-2 border-foreground p-2 md:p-4" ref={containerRef}>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h3 className="font-mono font-bold text-sm md:text-lg flex items-center gap-2 flex-shrink-0">
            <Paintbrush className="w-4 h-4 md:w-5 md:h-5" />
            <span className="hidden sm:inline">DOODLE MINING</span>
            <span className="sm:hidden">DOODLE</span>
          </h3>
          <div className="flex gap-1 md:gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={undo}
              disabled={historyStep <= 0}
              className="font-mono text-xs p-1 md:p-2 h-7 md:h-8"
              title="Undo (Ctrl+Z)"
            >
              <Undo className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={redo}
              disabled={historyStep >= history.length - 1}
              className="font-mono text-xs p-1 md:p-2 h-7 md:h-8"
              title="Redo (Ctrl+Y)"
            >
              <Redo className="w-3 h-3" />
            </Button>
            {isMobile && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowToolbar(!showToolbar)}
                className="font-mono text-xs p-1 md:p-2 h-7 md:h-8"
                title={showToolbar ? 'Hide Toolbar' : 'Show Toolbar'}
              >
                {showToolbar ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </Button>
            )}
          </div>
        </div>
        <p className="text-[10px] md:text-xs text-muted-foreground font-mono leading-tight">
          Draw, upload, enhance with AI, then export
        </p>
      </div>

      {/* Toolbar */}
      {showToolbar && (
      <div className="mb-4 flex flex-wrap items-center gap-2 md:gap-3 p-2 md:p-3 border-2 border-foreground bg-background">
        {/* Tool selection */}
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={tool === 'brush' ? 'default' : 'outline'}
            onClick={() => setTool('brush')}
            className="font-mono text-xs p-1 h-7"
            title="Brush (B)"
          >
            <Paintbrush className="w-3 h-3" />
            <span className="hidden sm:inline ml-1 text-[10px]">Brush</span>
          </Button>
          <Button
            size="sm"
            variant={tool === 'eraser' ? 'default' : 'outline'}
            onClick={() => setTool('eraser')}
            className="font-mono text-xs p-1 h-7"
            title="Eraser (E)"
          >
            <Eraser className="w-3 h-3" />
            <span className="hidden sm:inline ml-1 text-[10px]">Erase</span>
          </Button>
          <Button
            size="sm"
            variant={tool === 'stamp' ? 'default' : 'outline'}
            onClick={() => setTool('stamp')}
            className="font-mono text-xs p-1 h-7"
            title="Stamp (S)"
          >
            <Star className="w-3 h-3" />
            <span className="hidden sm:inline ml-1 text-[10px]">Stamp</span>
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
            >
              Normal
            </Button>
            <Button
              size="sm"
              variant={brushStyle === 'spray' ? 'default' : 'outline'}
              onClick={() => setBrushStyle('spray')}
              className="font-mono text-[10px] p-1 h-7"
              title="Spray"
            >
              Spray
            </Button>
            <Button
              size="sm"
              variant={brushStyle === 'calligraphy' ? 'default' : 'outline'}
              onClick={() => setBrushStyle('calligraphy')}
              className="font-mono text-[10px] p-1 h-7"
              title="Calligraphy"
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
            >
              <Circle className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant={stampType === 'square' ? 'default' : 'outline'}
              onClick={() => setStampType('square')}
              className="font-mono text-xs p-1 h-7"
              title="Square"
            >
              <Square className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant={stampType === 'star' ? 'default' : 'outline'}
              onClick={() => setStampType('star')}
              className="font-mono text-xs p-1 h-7"
              title="Star"
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
            className="font-mono text-xs p-1 md:p-2 h-7 md:h-8"
            title="Load image as background"
          >
            <Upload className="w-3 h-3" />
            <span className="hidden sm:inline ml-1">Img</span>
          </Button>
        </div>

        {/* Color picker - Mobile optimized */}
        {tool === 'brush' && (
          <div className="flex items-center gap-1 md:gap-2">
            <Label className="text-[10px] md:text-xs font-mono hidden sm:inline">Color:</Label>
            <div className="flex gap-1 items-center">
              <Input
                type="color"
                value={brushColor}
                onChange={(e) => setBrushColor(e.target.value)}
                className="w-7 h-7 md:w-10 md:h-8 p-0.5 md:p-1 cursor-pointer"
                title="Pick color"
              />
              <Input
                type="text"
                value={brushColor}
                onChange={(e) => setBrushColor(e.target.value)}
                className="w-14 md:w-20 h-7 md:h-8 font-mono text-[10px] md:text-xs"
              />
            </div>
          </div>
        )}

        {/* Brush size - Mobile optimized */}
        <div className="flex items-center gap-1 md:gap-2">
          <Label className="text-[10px] md:text-xs font-mono hidden sm:inline">Size:</Label>
          <Slider
            value={[brushSize]}
            onValueChange={(v) => setBrushSize(v[0])}
            min={1}
            max={50}
            step={1}
            className="w-16 md:w-24"
          />
          <span className="text-[10px] md:text-xs font-mono w-5 text-center">{brushSize}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-1 md:gap-2 md:ml-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={applyDitheringEffect}
            className="font-mono text-xs p-1 md:p-2 h-7 md:h-8"
            title="Apply dithering effect"
          >
            <Wand2 className="w-3 h-3" />
            <span className="hidden sm:inline ml-1">Dither</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={clearCanvas}
            className="font-mono text-xs p-1 md:p-2 h-7 md:h-8"
            title="Clear canvas"
          >
            <Trash2 className="w-3 h-3" />
            <span className="hidden sm:inline ml-1">Clear</span>
          </Button>
        </div>
      </div>
      )}

      {/* Canvas - Mobile optimized */}
      <div className="mb-4 border-2 border-foreground bg-card overflow-x-auto">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={onMove}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={onMove}
          onTouchEnd={stopDrawing}
          className="w-full h-auto cursor-crosshair touch-none block"
          style={{ touchAction: 'none', maxWidth: '100%', display: 'block' }}
        />
      </div>

      {/* AI Enhancement Panel */}
      <div className="space-y-2 md:space-y-3">
        <Button
          variant="outline"
          className="w-full font-mono text-xs md:text-sm p-2 md:p-3"
          onClick={() => setShowAiPanel(!showAiPanel)}
        >
          <Sparkles className="w-4 h-4 mr-2" />
          {showAiPanel ? 'Hide AI' : 'Enhance with AI'}
        </Button>

        {showAiPanel && (
          <div className="border-2 border-foreground p-2 md:p-3 space-y-2 md:space-y-3">
            <div>
              <Label className="font-mono text-[10px] md:text-xs mb-1 md:mb-2 block">
                AI PROMPT
              </Label>
              <Input
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Make it colorful, add shading..."
                className="font-mono text-xs p-1.5 md:p-2"
                disabled={generating}
              />
              <p className="text-[9px] md:text-[10px] text-muted-foreground font-mono mt-1">
                Describe the enhancement. Iterative refinement supported!
              </p>
            </div>
            <Button
              className="w-full font-mono text-xs md:text-sm p-2 md:p-3"
              onClick={generateWithAI}
              disabled={generating || !aiPrompt.trim()}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {generating ? 'GENERATING...' : 'ENHANCE'}
            </Button>
            <p className="text-[9px] md:text-[10px] text-center text-muted-foreground font-mono">
              💡 Click multiple times to refine
            </p>
          </div>
        )}

        {/* Export Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 font-mono text-xs md:text-sm p-1.5 md:p-2"
            onClick={downloadCanvas}
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline ml-1">Download</span>
          </Button>
          {onImageGenerated && (
            <Button
              className="flex-1 font-mono text-xs md:text-sm p-1.5 md:p-2"
              onClick={exportToThread}
            >
              <ImageIcon className="w-3 h-3" />
              <span className="hidden sm:inline ml-1">Use in Thread</span>
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}
