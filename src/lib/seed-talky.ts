import db from './db-client'

/**
 * Seed Talky AI bot as a permanent user
 * This ensures Talky exists in the database and appears in the online users list
 */
export async function seedTalkyBot() {
  try {
    // Check if Talky already exists
    const existingUser = await db.db.users.list({
      where: { id: 'talky-bot' },
      limit: 1
    })

    if (existingUser && existingUser.length > 0) {
      console.log('✓ Talky bot already exists')
      
      // Update activity to ensure Talky is shown as online
      const activity = await db.db.chatActivity.list({
        where: { userId: 'talky-bot' },
        limit: 1
      })
      
      if (activity && activity.length > 0) {
        await db.db.chatActivity.update(activity[0].id, {
          lastActivity: new Date().toISOString()
        })
      } else {
        await db.db.chatActivity.create({
          id: 'activity-talky-bot',
          userId: 'talky-bot',
          username: 'Talky',
          lastActivity: new Date().toISOString()
        })
      }
      
      return existingUser[0]
    }

    // Create Talky user
    const talkyUser = await db.db.users.create({
      id: 'talky-bot',
      username: 'Talky',
      email: 'talky@haichan.bot',
      passwordHash: 'NO_PASSWORD_BOT_ACCOUNT',
      bitcoinAddress: null,
      totalPowPoints: 999999,
      diamondLevel: 99,
      isAdmin: 0,
      displayName: 'Talky AI Bot',
      emailVerified: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSignIn: new Date().toISOString()
    })

    // Create permanent activity entry
    await db.db.chatActivity.create({
      id: 'activity-talky-bot',
      userId: 'talky-bot',
      username: 'Talky',
      lastActivity: new Date().toISOString()
    })

    console.log('✓ Talky bot created successfully')
    return talkyUser
  } catch (error) {
    console.error('Failed to seed Talky bot:', error)
    throw error
  }
}
