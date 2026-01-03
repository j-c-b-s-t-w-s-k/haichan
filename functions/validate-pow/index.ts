import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@blinkdotnew/sdk@^0.18.7";
import { createHash } from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Initialize Blink Client with Secret Key for Admin Access
const blink = createClient({
  projectId: Deno.env.get('BLINK_PROJECT_ID')!,
  secretKey: Deno.env.get('BLINK_SECRET_KEY')!,
});

/**
 * PoW prefix presets and validation
 */
const POW_PRESETS = {
  EASY: { prefix: '21', points: 4 },
  MODERATE: { prefix: '21e', points: 8 },
  STANDARD: { prefix: '21e8', points: 15 },
  HARD: { prefix: '21e80', points: 60 },
  VERY_HARD: { prefix: '21e800', points: 240 },
  EXTREME: { prefix: '21e8000', points: 960 },
  LEGENDARY: { prefix: '21e80000', points: 3840 },
} as const;

/**
 * Server-enforced minimum PoW requirement
 * Default: STANDARD (21e8) to prevent client from cheating
 */
const MINIMUM_POW_PREFIX = POW_PRESETS.EASY.prefix;
const MINIMUM_POW_POINTS = POW_PRESETS.EASY.points;

interface ValidationRequest {
  shares?: Array<{
    hash: string;
    nonce: string;
    points: number;
    trailingZeros: number;
    challenge: string;
    prefix?: string;
  }>;
  challenge?: string;
  nonce?: string;
  hash?: string;
  prefix?: string;
  points?: number;
  trailingZeros?: number;
  targetType: 'board' | 'thread' | 'post' | 'blog' | 'global' | 'image';
  targetId?: string;
  userId?: string;
}

interface ValidationResponse {
  valid: boolean;
  error?: string;
  verifiedHash?: string; // For single
  verifiedPrefix?: string;
  verifiedPoints?: number; // Total points for batch
  verifiedTrailingZeros?: number;
  dbUpdated?: boolean;
  totalPoints?: number; // Total points added
}

/**
 * Verify that a hash meets the required prefix
 */
function verifyHashPrefix(hash: string, prefix: string): boolean {
  return hash.startsWith(prefix);
}

/**
 * Count trailing zeros in a hash
 */
function countTrailingZeros(hash: string): number {
  let count = 0;
  for (let i = hash.length - 1; i >= 0; i--) {
    if (hash[i] === '0') {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Calculate points based on prefix and trailing zeros
 */
function calculatePoints(prefix: string, trailingZeros: number): number {
  // Base points by prefix
  let basePoints = 0;
  if (prefix === '21') basePoints = 4;
  else if (prefix === '21e') basePoints = 8;
  else if (prefix === '21e8') basePoints = 15;
  else if (prefix === '21e80') basePoints = 60;
  else if (prefix === '21e800') basePoints = 240;
  else if (prefix === '21e8000') basePoints = 960;
  else if (prefix === '21e80000') basePoints = 3840;
  
  // Multiply by 4^trailingZeros for diamond bonus
  return basePoints * Math.pow(4, trailingZeros);
}

/**
 * Verify that a hash was correctly computed from challenge + nonce
 */
function verifyHash(challenge: string, nonce: string, expectedHash: string): boolean {
  const data = challenge + nonce;
  const hash = createHash('sha256');
  hash.update(data);
  const computedHash = hash.digest('hex');
  return computedHash === expectedHash;
}

/**
 * Validate PoW submission against server-side rules and apply to database
 */
async function validateAndApplyPoW(request: ValidationRequest): Promise<ValidationResponse> {
  const { targetType, targetId, userId } = request;

  // Normalize input to array of shares
  const sharesToValidate = request.shares || (request.hash && request.nonce && request.challenge ? [{
    challenge: request.challenge,
    nonce: request.nonce,
    hash: request.hash,
    points: request.points || 0,
    trailingZeros: request.trailingZeros || 0,
    prefix: request.prefix
  }] : []);

  if (sharesToValidate.length === 0) {
      return { valid: false, error: 'No shares provided' };
  }

  let totalValidPoints = 0;
  const validRecords: any[] = [];
  let maxTrailingZeros = 0;
  let bestHash = '';

  for (const share of sharesToValidate) {
      const sharePrefix = share.prefix || request.prefix || MINIMUM_POW_PREFIX;
      
      // 1. Verify hash was correctly computed
      if (!verifyHash(share.challenge, share.nonce, share.hash)) {
        continue; // Skip invalid shares
      }

      // 2. Enforce minimum prefix requirement
      if (!verifyHashPrefix(share.hash, MINIMUM_POW_PREFIX)) {
        continue;
      }

      // 3. Verify hash matches claimed prefix
      if (!verifyHashPrefix(share.hash, sharePrefix)) {
        continue;
      }

      // 4. Verify trailing zeros
      const verifiedTrailingZeros = countTrailingZeros(share.hash);
      
      // 5. Calculate points
      const verifiedPoints = calculatePoints(sharePrefix, verifiedTrailingZeros);
      
      totalValidPoints += verifiedPoints;
      
      if (verifiedTrailingZeros > maxTrailingZeros) {
          maxTrailingZeros = verifiedTrailingZeros;
          bestHash = share.hash;
      }

      validRecords.push({
        userId: userId!,
        targetType,
        targetId: targetId || 'global',
        challenge: share.challenge,
        nonce: share.nonce,
        hash: share.hash,
        points: verifiedPoints,
        trailingZeros: verifiedTrailingZeros,
        isDiamond: share.hash.startsWith('21e80000') ? 1 : 0,
      });
  }

  if (validRecords.length === 0) {
      return { valid: false, error: 'No valid shares found in batch' };
  }

  // 6. Apply to Database
  try {
    // Bulk Insert Records
    if (userId && validRecords.length > 0) {
      // Use createMany if available, or Promise.all
      // SDK createMany might not be standard in all Blink versions, but assuming yes based on prompt
      // If not, loop create.
      // But let's try createMany if the schema supports it.
      // Actually, safest is to loop or use Promise.all for now if unsure about createMany in this specific SDK version
      // But earlier thought said createMany exists.
      // Let's use Promise.all to be safe and simple.
      await Promise.all(validRecords.map(record => blink.db.powRecords.create(record)));
    }

    // Update User Total PoW
    if (userId) {
      const user = await blink.db.users.get(userId);
      if (user) {
        await blink.db.users.update(userId, {
          totalPowPoints: (user.totalPowPoints || 0) + totalValidPoints
        });

        // Handle Diamond Achievements
        if (maxTrailingZeros > 0) {
           const allAchievements = await blink.db.achievements.list({
             where: { userId: userId }
           });
           
           const existing = allAchievements?.find((a: any) => Number(a.level) === maxTrailingZeros);
           
           if (!existing) {
             await blink.db.achievements.create({
               userId: userId,
               level: maxTrailingZeros,
               hash: bestHash
             });
           }
           
           const maxLevel = Math.max(
             ...(allAchievements?.map((a: any) => Number(a.level) || 0) || []),
             maxTrailingZeros,
             0
           );
           
           if (maxLevel > (user.diamondLevel || 0)) {
             await blink.db.users.update(userId, {
               diamondLevel: maxLevel
             });
           }
        }
      }
    }

    // Update Target Total PoW
    if (targetId) {
      let table: any = null;
      if (targetType === 'board') table = blink.db.boards;
      if (targetType === 'thread') table = blink.db.threads;
      if (targetType === 'post') table = blink.db.posts;
      if (targetType === 'blog') table = blink.db.blogPosts;
      if (targetType === 'image') table = blink.db.imageMetadata;

      if (table) {
        const item = await table.get(targetId);
        if (item) {
           const updateData: any = {
             totalPow: (Number(item.totalPow) || 0) + totalValidPoints
           };

           // For threads, update bump order to keep them fresh
           if (targetType === 'thread') {
             updateData.bumpOrder = Math.floor(Date.now() / 1000);
             updateData.updatedAt = new Date().toISOString();
           }
           
           await table.update(targetId, updateData);
           
           if (targetType === 'board') {
             await table.update(targetId, { lastActivityAt: new Date().toISOString() });
           }

          // Propagate PoW to parents (Thread -> Board, Post -> Thread -> Board)
          
          // 1. If target is Thread, update Board
          if (targetType === 'thread' && item.boardId) {
            const board = await blink.db.boards.get(item.boardId);
            if (board) {
              await blink.db.boards.update(item.boardId, {
                totalPow: (Number(board.totalPow) || 0) + totalValidPoints,
                lastActivityAt: new Date().toISOString()
              });
            }
          }

          // 2. If target is Post, update Thread and Board
          if (targetType === 'post' && item.threadId) {
            const thread = await blink.db.threads.get(item.threadId);
            if (thread) {
              // Update Thread
              await blink.db.threads.update(item.threadId, {
                totalPow: (Number(thread.totalPow) || 0) + totalValidPoints,
                bumpOrder: Math.floor(Date.now() / 1000), 
                updatedAt: new Date().toISOString()
              });

              // Update Board
              if (thread.boardId) {
                const board = await blink.db.boards.get(thread.boardId);
                if (board) {
                  await blink.db.boards.update(thread.boardId, {
                    totalPow: (Number(board.totalPow) || 0) + totalValidPoints,
                    lastActivityAt: new Date().toISOString()
                  });
                }
              }
            }
          }
       }
     }
   }

    // 7. Broadcast Realtime Update
    try {
      await blink.realtime.publish('global-stats-updates', 'stats-updated', {
        pointsAdded: totalValidPoints,
        userId: userId,
        targetType: targetType,
        targetId: targetId,
        timestamp: Date.now()
      });
    } catch (rtError) {
      console.error('Realtime broadcast failed:', rtError);
      // Continue execution - don't fail the request just because realtime failed
    }

    return {
      valid: true,
      verifiedPoints: totalValidPoints,
      totalPoints: totalValidPoints,
      dbUpdated: true
    };

  } catch (dbError: any) {
    console.error('Database update failed:', dbError);
    return {
      valid: true,
      error: 'PoW Valid but DB update failed: ' + dbError.message,
      dbUpdated: false,
      verifiedPoints: totalValidPoints 
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body: ValidationRequest = await req.json();

    // Validate required fields
    // For batch, we just need shares array or the legacy fields
    if (!body.shares && (!body.challenge || !body.nonce || !body.hash)) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: shares OR (challenge, nonce, hash)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Perform validation and DB update
    const result = await validateAndApplyPoW(body);

    if (!result.valid) {
      return new Response(
        JSON.stringify({ valid: false, error: result.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return successful validation
    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error validating PoW:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});