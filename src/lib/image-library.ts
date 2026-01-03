import db from './db-client'
import { withRateLimit } from './rate-limit-utils'

/**
 * Save an uploaded image to the user's image library
 * Uses upsert to handle duplicate entries gracefully
 * Includes automatic rate limit handling and retry logic
 * @param imageUrl - The URL of the image
 * @param imageName - The name of the image
 * @param imageSize - The size of the image in bytes
 * @param userId - The ID of the user (from auth context, required)
 */
export async function saveToImageLibrary(
  imageUrl: string,
  imageName: string,
  imageSize: number,
  userId: string
): Promise<void> {
  try {
    if (!userId) {
      console.warn('No user ID provided, skipping image library save')
      return
    }

    const finalUserId = userId

    // First, try to check if it exists (with caching to reduce queries)
    const existing = await withRateLimit(
      () => db.db.imageMetadata.list({
        where: { userId: finalUserId, imageUrl }
      }),
      { maxRetries: 3, initialDelayMs: 100 }
    )

    if (existing.length > 0) {
      // Image already exists - increment use count
      await withRateLimit(
        () => db.db.imageMetadata.update(existing[0].id, {
          useCount: Number(existing[0].useCount) + 1
        }),
        { maxRetries: 2, initialDelayMs: 50 }
      )
      return
    }

    // Try to create - if constraint fails, silently handle it
    try {
      await withRateLimit(
        () => db.db.imageMetadata.create({
          userId: finalUserId,
          imageUrl,
          imageName,
          imageSize,
          uploadedAt: new Date().toISOString(),
          isFavorite: 0,
          useCount: 1 // Start at 1 since it's being used now
        }),
        { maxRetries: 3, initialDelayMs: 100 }
      )
    } catch (createError: any) {
      // If duplicate constraint error, try to increment use count instead
      if (createError?.status === 409 || createError?.code === 'NETWORK_ERROR') {
        console.log('Image already exists (race condition), incrementing use count')
        
        // Re-fetch and increment
        const refetched = await withRateLimit(
          () => db.db.imageMetadata.list({
            where: { userId: finalUserId, imageUrl }
          }),
          { maxRetries: 3, initialDelayMs: 100 }
        )
        
        if (refetched.length > 0) {
          await withRateLimit(
            () => db.db.imageMetadata.update(refetched[0].id, {
              useCount: Number(refetched[0].useCount) + 1
            }),
            { maxRetries: 2, initialDelayMs: 50 }
          )
        }
      } else {
        // Unexpected error, log it but don't throw
        console.error('Unexpected error creating image metadata:', createError)
      }
    }
  } catch (error) {
    console.error('Failed to save image to library:', error)
    // Don't throw - this is a non-critical operation
  }
}

/**
 * Increment the use count for an image in the library
 * Includes automatic rate limit handling and retry logic
 * @param imageUrl - The URL of the image
 * @param userId - The ID of the user (from auth context, required)
 */
export async function incrementImageUse(imageUrl: string, userId: string): Promise<void> {
  try {
    if (!userId) return

    const finalUserId = userId

    const existing = await withRateLimit(
      () => db.db.imageMetadata.list({
        where: { userId: finalUserId, imageUrl }
      }),
      { maxRetries: 3, initialDelayMs: 100 }
    )

    if (existing.length > 0) {
      await withRateLimit(
        () => db.db.imageMetadata.update(existing[0].id, {
          useCount: Number(existing[0].useCount) + 1
        }),
        { maxRetries: 2, initialDelayMs: 50 }
      )
    }
  } catch (error) {
    console.error('Failed to increment image use:', error)
  }
}
