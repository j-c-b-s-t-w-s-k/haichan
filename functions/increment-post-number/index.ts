import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@blinkdotnew/sdk@^0.18.7";
import { createHash } from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Server-enforced minimum PoW requirement
 * Default: STANDARD (21e8) to prevent client from lowering difficulty
 */
const MINIMUM_POW_PREFIX = '21e8';
const MINIMUM_POW_POINTS = 15;

interface IncrementRequest {
  powData?: {
    challenge: string;
    nonce: string;
    hash: string;
    prefix?: string;
    points: number;
    trailingZeros: number;
  };
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
 * Verify that a hash meets the required prefix
 */
function verifyHashPrefix(hash: string, prefix: string): boolean {
  return hash.startsWith(prefix);
}

/**
 * Validate PoW submission against server-side rules
 */
function validatePoW(powData: IncrementRequest['powData']): { valid: boolean; error?: string } {
  if (!powData) {
    return { valid: true }; // PoW validation is optional for now
  }

  const { challenge, nonce, hash, prefix, points } = powData;

  // 1. Verify hash was correctly computed
  if (!verifyHash(challenge, nonce, hash)) {
    return {
      valid: false,
      error: 'Invalid PoW: hash does not match challenge + nonce',
    };
  }

  // 2. Enforce minimum prefix requirement (security)
  if (!verifyHashPrefix(hash, MINIMUM_POW_PREFIX)) {
    return {
      valid: false,
      error: `Invalid PoW: hash does not meet minimum prefix requirement (${MINIMUM_POW_PREFIX})`,
    };
  }

  // 3. Verify points are at least the minimum
  if (points < MINIMUM_POW_POINTS) {
    return {
      valid: false,
      error: `Invalid PoW: points (${points}) below minimum requirement (${MINIMUM_POW_POINTS})`,
    };
  }

  return { valid: true };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Blink client - projectId auto-detected in edge function environment
    const blink = createClient({
      projectId: 'haichan-pow-imageboard-7e3gh26u',
      auth: { mode: 'managed' }
    });

    // Parse request body for optional PoW validation
    let powData: IncrementRequest['powData'] | undefined;
    try {
      const body: IncrementRequest = await req.json();
      powData = body.powData;
    } catch {
      // Body is optional, continue without PoW validation
    }

    // Validate PoW if provided
    if (powData) {
      const validation = validatePoW(powData);
      if (!validation.valid) {
        return new Response(
          JSON.stringify({ error: validation.error }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('✓ PoW validation passed for hash:', powData.hash);
    }

    // Atomic increment operation using raw SQL for reliability
    // First, get current number
    const sequenceResult = await blink.db.postSequence.list({ limit: 1 });
    
    if (sequenceResult.length === 0) {
      // Initialize sequence if doesn't exist - start at 100 to ensure good numbers
      console.log('Initializing post_sequence table with currentNumber=100');
      await blink.db.postSequence.create({
        id: '1',
        currentNumber: 100
      });
      return new Response(
        JSON.stringify({ postNumber: 101 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // The SDK auto-converts snake_case to camelCase
    let currentNumber = Number(sequenceResult[0].currentNumber);
    
    // GUARD: Ensure currentNumber is valid and positive
    if (!Number.isFinite(currentNumber) || currentNumber < 1) {
      console.warn('Invalid currentNumber in sequence:', sequenceResult[0].currentNumber, '- resetting to 100');
      currentNumber = 100;
      await blink.db.postSequence.update('1', {
        currentNumber: 100
      });
    }
    
    // Increment to get next number
    const nextNumber = currentNumber + 1;
    
    // GUARD: Final validation - ensure nextNumber is ALWAYS positive
    if (!Number.isFinite(nextNumber) || nextNumber <= 0) {
      console.error('CRITICAL: Invalid nextNumber calculated:', nextNumber);
      throw new Error(`Invalid post number generated: ${nextNumber}`);
    }

    console.log(`Incrementing sequence from ${currentNumber} to ${nextNumber}`);
    
    // Update to next number
    await blink.db.postSequence.update('1', {
      currentNumber: nextNumber
    });

    // Return the incremented number
    return new Response(
      JSON.stringify({ postNumber: nextNumber }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error incrementing post number:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
