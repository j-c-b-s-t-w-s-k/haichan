import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "npm:@blinkdotnew/sdk@^0.18.7"

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    })
  }

  try {
    const blink = createClient({
      projectId: Deno.env.get('BLINK_PROJECT_ID')!,
      secretKey: Deno.env.get('BLINK_SECRET_KEY')!
    })

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // Mark expired threads (7 days since last post or created)
    const threadsToExpire = await blink.db.threads.list({
      where: {
        AND: [
          { expired: '0' },
          {
            OR: [
              { lastPostAt: { lt: sevenDaysAgo } },
              { 
                AND: [
                  { lastPostAt: null },
                  { createdAt: { lt: sevenDaysAgo } }
                ]
              }
            ]
          }
        ]
      }
    })

    for (const thread of threadsToExpire) {
      await blink.db.threads.update(thread.id, { expired: 1 })
    }

    // Mark expired boards (7 days of inactivity)
    const boardsToExpire = await blink.db.boards.list({
      where: {
        AND: [
          { expired: '0' },
          {
            OR: [
              { lastActivityAt: { lt: sevenDaysAgo } },
              { 
                AND: [
                  { lastActivityAt: null },
                  { createdAt: { lt: sevenDaysAgo } }
                ]
              }
            ]
          }
        ]
      }
    })

    for (const board of boardsToExpire) {
      await blink.db.boards.update(board.id, { expired: 1 })
    }

    // Also check catalog limit: mark threads beyond catalog limit as expired
    const boards = await blink.db.boards.list({ where: { expired: '0' } })
    
    for (const board of boards) {
      const threads = await blink.db.threads.list({
        where: { boardId: board.id, expired: '0' },
        orderBy: { totalPow: 'desc' }
      })

      // Keep top 150 threads in catalog, expire the rest
      const CATALOG_LIMIT = 150
      if (threads.length > CATALOG_LIMIT) {
        const threadsToExpireFromCatalog = threads.slice(CATALOG_LIMIT)
        for (const thread of threadsToExpireFromCatalog) {
          await blink.db.threads.update(thread.id, { expired: 1 })
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        expired_threads: threadsToExpire.length,
        expired_boards: boardsToExpire.length
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  } catch (error) {
    console.error('Cleanup error:', error)
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  }
})
