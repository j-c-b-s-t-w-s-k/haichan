/**
 * Apply Floyd-Steinberg dithering to an image
 * @param imageData - ImageData object from canvas
 * @returns Modified ImageData with dithering applied
 */
export function applyDithering(imageData: ImageData): ImageData {
  const data = imageData.data
  const width = imageData.width
  const height = imageData.height

  // Floyd-Steinberg dithering algorithm
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4

      // Convert to grayscale
      const gray = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114
      
      // Threshold to black or white
      const newGray = gray < 128 ? 0 : 255
      
      // Calculate quantization error
      const error = gray - newGray

      // Set pixel to black or white
      data[index] = newGray
      data[index + 1] = newGray
      data[index + 2] = newGray

      // Distribute error to neighboring pixels
      if (x + 1 < width) {
        const rightIndex = (y * width + (x + 1)) * 4
        data[rightIndex] += error * 7 / 16
        data[rightIndex + 1] += error * 7 / 16
        data[rightIndex + 2] += error * 7 / 16
      }

      if (y + 1 < height) {
        if (x - 1 >= 0) {
          const bottomLeftIndex = ((y + 1) * width + (x - 1)) * 4
          data[bottomLeftIndex] += error * 3 / 16
          data[bottomLeftIndex + 1] += error * 3 / 16
          data[bottomLeftIndex + 2] += error * 3 / 16
        }

        const bottomIndex = ((y + 1) * width + x) * 4
        data[bottomIndex] += error * 5 / 16
        data[bottomIndex + 1] += error * 5 / 16
        data[bottomIndex + 2] += error * 5 / 16

        if (x + 1 < width) {
          const bottomRightIndex = ((y + 1) * width + (x + 1)) * 4
          data[bottomRightIndex] += error * 1 / 16
          data[bottomRightIndex + 1] += error * 1 / 16
          data[bottomRightIndex + 2] += error * 1 / 16
        }
      }
    }
  }

  return imageData
}

/**
 * Process an image element with dithering effect
 * @param imgElement - HTML image element
 * @param strength - Dithering strength (0-1, default 1)
 * @returns Promise resolving to data URL of dithered image
 */
export async function ditherImage(imgElement: HTMLImageElement, strength: number = 1): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      canvas.width = imgElement.naturalWidth || imgElement.width
      canvas.height = imgElement.naturalHeight || imgElement.height

      // Draw original image
      ctx.drawImage(imgElement, 0, 0)

      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

      // Apply dithering if strength > 0
      if (strength > 0) {
        const ditheredData = applyDithering(imageData)
        ctx.putImageData(ditheredData, 0, 0)
      }

      // Convert to data URL
      resolve(canvas.toDataURL('image/png'))
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Process an image file with dithering
 * @param file - Image file
 * @param strength - Dithering strength (0-1)
 * @returns Promise resolving to data URL of dithered image
 */
export async function ditherImageFile(file: File, strength: number = 1): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()

    reader.onload = (e) => {
      img.onload = async () => {
        try {
          const dithered = await ditherImage(img, strength)
          resolve(dithered)
        } catch (error) {
          reject(error)
        }
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }

    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
