import { useState, useEffect, useRef } from 'react'
import { ditherImage } from '../../lib/dither'

interface DitheredImageProps {
  src: string
  alt: string
  className?: string
  onClick?: () => void
}

export function DitheredImage({ src, alt, className = '', onClick }: DitheredImageProps) {
  const [processedSrc, setProcessedSrc] = useState<string>(src)
  const [loading, setLoading] = useState(true)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const settings = localStorage.getItem('haichan-settings')
    let ditheringEnabled = true // Default to enabled
    
    if (settings) {
      try {
        const parsed = JSON.parse(settings)
        ditheringEnabled = parsed.ditheringEnabled !== false
      } catch (error) {
        console.error('Failed to parse settings:', error)
      }
    }

    if (!ditheringEnabled) {
      // If dithering is disabled, use original image
      setProcessedSrc(src)
      setLoading(false)
      return
    }

    // Load and process image
    const img = new Image()
    img.crossOrigin = 'anonymous'
    
    img.onload = async () => {
      try {
        const dithered = await ditherImage(img, 1)
        setProcessedSrc(dithered)
      } catch (error) {
        console.error('Dithering failed:', error)
        // Fallback to original image
        setProcessedSrc(src)
      } finally {
        setLoading(false)
      }
    }

    img.onerror = () => {
      // Fallback to original image on error
      setProcessedSrc(src)
      setLoading(false)
    }

    img.src = src
  }, [src])

  return (
    <>
      {loading && (
        <div className="flex items-center justify-center bg-gray-100 animate-pulse">
          <span className="font-mono text-xs text-gray-500">PROCESSING...</span>
        </div>
      )}
      <img
        ref={imgRef}
        src={processedSrc}
        alt={alt}
        className={`${className} ${loading ? 'hidden' : ''}`}
        onClick={onClick}
        style={{ imageRendering: 'pixelated' }}
      />
    </>
  )
}
