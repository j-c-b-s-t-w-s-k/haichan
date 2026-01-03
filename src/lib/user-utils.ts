import db from './db-client'

/**
 * Get the username of the most recently registered user
 * @returns The username of the latest registered user, or null if no users exist
 */
export async function getMostRecentUserUsername(): Promise<string | null> {
  try {
    const users = await db.db.users.list({
      limit: 1,
      orderBy: { createdAt: 'desc' }
    })

    if (users.length === 0) {
      return null
    }

    const latestUser = users[0]
    return latestUser.username || null
  } catch (error) {
    console.error('Failed to fetch most recent user:', error)
    return null
  }
}

/**
 * Get the most recent user with full details
 * @returns The latest registered user object with all details
 */
export async function getMostRecentUser(): Promise<any> {
  try {
    const users = await db.db.users.list({
      limit: 1,
      orderBy: { createdAt: 'desc' }
    })

    if (users.length === 0) {
      return null
    }

    return users[0]
  } catch (error) {
    console.error('Failed to fetch most recent user:', error)
    return null
  }
}

/**
 * Get N most recent users
 * @param count - Number of recent users to fetch
 * @returns Array of user objects sorted by creation date (newest first)
 */
export async function getMostRecentUsers(count: number = 10): Promise<any[]> {
  try {
    const users = await db.db.users.list({
      limit: count,
      orderBy: { createdAt: 'desc' }
    })

    return users
  } catch (error) {
    console.error('Failed to fetch recent users:', error)
    return []
  }
}
