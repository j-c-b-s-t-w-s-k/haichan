/**
 * GIF Encoder utility for canvas animation export
 * Handles creation of animated GIFs from canvas frames
 */

export interface GIFExportOptions {
  width: number
  height: number
  frames: string[] // dataUrls
  delay?: number // milliseconds per frame
  quality?: number // 1-30, lower is better quality
}

/**
 * Create an animated GIF from canvas frames
 * Returns a Blob ready for upload
 */
export async function generateGIFFromFrames(options: GIFExportOptions): Promise<Blob> {
  const { width, height, frames, delay = 100, quality = 10 } = options

  // Dynamically import gif.js
  const { default: GifJs } = await import('gif.js')

  return new Promise((resolve, reject) => {
    try {
      const gif = new GifJs({
        workers: 2,
        quality,
        width,
        height,
        // Use @vite-ignore to suppress the build warning
        // The worker script will be resolved at runtime
        workerScript: (() => {
          try {
            // Try to get the gif worker from the gif.js package
            return new URL('gif.worker.js', import.meta.url).href
          } catch {
            // Fallback if not found
            return 'gif.worker.js'
          }
        })()
      })

      let loadedFrames = 0

      // Convert all dataUrl frames to images and add to GIF
      frames.forEach((dataUrl) => {
        const img = new Image()
        img.onload = () => {
          gif.addFrame(img, { delay })
          loadedFrames++

          // When all frames are loaded, render the GIF
          if (loadedFrames === frames.length) {
            gif.render()
          }
        }
        img.onerror = () => {
          reject(new Error(`Failed to load frame: ${dataUrl.substring(0, 50)}...`))
        }
        img.src = dataUrl
      })

      // Handle rendering completion
      gif.on('finished', (blob: Blob) => {
        resolve(blob)
      })

      gif.on('error', (error: Error) => {
        reject(error)
      })
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Alternative: Simple frame sequence export
 * If GIF encoder fails, export frames as a JSON sequence
 */
export function exportFrameSequence(frames: string[]): Blob {
  const sequence = {
    version: 1,
    frameCount: frames.length,
    frames: frames.map((dataUrl, idx) => ({
      index: idx,
      dataUrl
    }))
  }

  return new Blob([JSON.stringify(sequence)], { type: 'application/json' })
}
