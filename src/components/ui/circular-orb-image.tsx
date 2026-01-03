import { useState } from 'react'

interface CircularOrbImageProps {
  src: string
  alt: string
  size?: number
  className?: string
  imageClassName?: string
}

/**
 * CircularOrbImage component that displays an image with a circular mask.
 * Only the circular orb in the center is visible; black background is cropped out.
 * 
 * @param src - Image source URL
 * @param alt - Alt text for accessibility
 * @param size - Size in pixels (width and height, default 256)
 * @param className - CSS class for container
 * @param imageClassName - CSS class for the image element
 */
export function CircularOrbImage({
  src,
  alt,
  size = 256,
  className = '',
  imageClassName = ''
}: CircularOrbImageProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const handleLoad = () => {
    setIsLoading(false)
  }

  const handleError = () => {
    setIsLoading(false)
    setHasError(true)
  }

  if (hasError) {
    return (
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          backgroundColor: '#f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        className={className}
      >
        <span className="text-xs font-mono">Error loading image</span>
      </div>
    )
  }

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        overflow: 'hidden',
        flexShrink: 0,
        backgroundColor: '#000',
        borderRadius: 0
      }}
      className={className}
    >
      <img
        src={src}
        alt={alt}
        onLoad={handleLoad}
        onError={handleError}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center',
          opacity: isLoading ? 0.5 : 1,
          transition: 'opacity 0.3s ease-in-out'
        }}
        className={imageClassName}
      />
    </div>
  )
}
