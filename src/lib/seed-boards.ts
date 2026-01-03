/**
 * Seed function to create Music and Gif boards
 */

import db from './db-client'

export async function seedBoards() {
  try {
    console.log('🚀 Seeding Music and Gif boards...')

    // Check if boards already exist
    const existingBoards = await db.db.boards.list({})
    const musicBoardExists = existingBoards.some(b => b.slug === 'music')
    const gifBoardExists = existingBoards.some(b => b.slug === 'gif')

    if (musicBoardExists) {
      console.log('✓ Music board already exists')
    } else {
      console.log('📝 Creating Music board...')
      await db.db.boards.create({
        name: 'Music',
        slug: 'music',
        description: 'Share, discuss, and rate music content',
        totalPow: 0,
        createdAt: new Date().toISOString()
      })
      console.log('✓ Music board created')
    }

    if (gifBoardExists) {
      console.log('✓ Gif board already exists')
    } else {
      console.log('📝 Creating Gif board...')
      await db.db.boards.create({
        name: 'Gif',
        slug: 'gif',
        description: 'GIF and WebM animations only',
        totalPow: 0,
        createdAt: new Date().toISOString()
      })
      console.log('✓ Gif board created')
    }

    console.log('✅ Board seeding complete!')
    return { success: true }
  } catch (error: any) {
    console.error('❌ Board seeding failed:', error.message)
    throw new Error(`Failed to seed boards: ${error.message}`)
  }
}
