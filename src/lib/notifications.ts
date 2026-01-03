import db from './db-client'

export async function createNotificationsForPost(
  content: string, 
  threadId: string, 
  postId: string, 
  senderId: string,
  replyToPostId?: string // direct parent
) {
  try {
    // 1. Find all >>(\d+) patterns
    const matches = content.match(/>>(\d+)/g) || []
    const quotedNumbers = matches.map(m => m.replace('>>', ''))
    
    // 2. Fetch thread posts to resolve numbers
    // In a real production app, we would query specifically for these numbers
    // But for now, fetching thread posts is acceptable
    const threadPosts = await db.db.posts.list({ where: { threadId } })
    const threads = await db.db.threads.list({ where: { id: threadId } })
    const threadOp = threads.length > 0 ? threads[0] : null
    
    const notifiedUserIds = new Set<string>()
  
    // Handle direct reply (from button context)
    if (replyToPostId) {
       // Check if it's a post
       const parent = threadPosts.find(p => p.id === replyToPostId)
       if (parent) {
         if (parent.userId !== senderId) notifiedUserIds.add(parent.userId)
       } else if (threadOp && threadOp.id === replyToPostId) {
         // It might be a reply to OP
         if (threadOp.userId !== senderId) notifiedUserIds.add(threadOp.userId)
       }
    }
  
    // Handle text mentions
    for (const numStr of quotedNumbers) {
      const num = parseInt(numStr)
      if (isNaN(num)) continue

      // Check if it's OP
      if (threadOp && (threadOp.post_number || threadOp.postNumber) == num) {
        if (threadOp.userId !== senderId) notifiedUserIds.add(threadOp.userId)
      }
      
      const targetPost = threadPosts.find(p => (p.post_number || p.postNumber) == num)
      if (targetPost && targetPost.userId !== senderId) {
        notifiedUserIds.add(targetPost.userId)
      }
    }
  
    // Insert notifications
    for (const userId of notifiedUserIds) {
      await db.db.notifications.create({
        user_id: userId,
        sender_id: senderId,
        post_id: postId,
        thread_id: threadId,
        type: 'reply',
        created_at: new Date().toISOString()
      })
    }
    
    console.log(`Created notifications for ${notifiedUserIds.size} users`)
  } catch (error) {
    console.error('Failed to create notifications:', error)
  }
}
