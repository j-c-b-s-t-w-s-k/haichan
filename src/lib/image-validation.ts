/**
 * Image validation utilities for board-specific restrictions
 */

export type AllowedImageType = 'any' | 'gif-webm'

/**
 * Validate image file type based on board restrictions
 * @param file - The file to validate
 * @param boardSlug - The board slug (e.g., 'gif', 'music')
 * @returns true if valid, false otherwise
 */
export function isValidImageForBoard(file: File | null, boardSlug: string | undefined): boolean {
  if (!file) return false

  const mimeType = file.type.toLowerCase()
  const filename = file.name.toLowerCase()

  // Gif board only accepts GIF and WebM
  if (boardSlug === 'gif') {
    const isGif = mimeType === 'image/gif' || filename.endsWith('.gif')
    const isWebM = mimeType === 'video/webm' || filename.endsWith('.webm')
    return isGif || isWebM
  }

  // Music board accepts any image
  if (boardSlug === 'music') {
    return mimeType.startsWith('image/')
  }

  // Default: accept any image
  return mimeType.startsWith('image/')
}

/**
 * Get allowed file types for a board
 * @param boardSlug - The board slug
 * @returns Human-readable string of allowed types
 */
export function getAllowedImageTypesForBoard(boardSlug: string | undefined): string {
  if (boardSlug === 'gif') {
    return 'GIF, WebM'
  }
  return 'Any image format (PNG, JPG, GIF, WebM, etc.)'
}

/**
 * Get validation error message for invalid file
 * @param boardSlug - The board slug
 * @returns Error message
 */
export function getImageValidationError(boardSlug: string | undefined): string {
  if (boardSlug === 'gif') {
    return 'Gif board only accepts GIF and WebM files'
  }
  return 'Please select a valid image file'
}
