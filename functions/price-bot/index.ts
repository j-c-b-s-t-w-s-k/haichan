import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@blinkdotnew/sdk@^0.18.7";

const blink = createClient({
  projectId: 'haichan-pow-imageboard-7e3gh26u',
  auth: { mode: 'managed' }
});

const PRICE_BOT_USER_ID = 'price-bot';
const PRICE_BOT_USERNAME = 'PriceBot';

// Ticker pattern: $(SYMBOL) or $SYMBOL
const TICKER_PATTERN = /\$\(([A-Za-z0-9]+)\)|\$([A-Za-z0-9]+)/g;

interface PriceData {
  symbol: string;
  price: number;
  change24h?: number;
  type: 'crypto' | 'stock';
  source: string;
}

/**
 * Fetch cryptocurrency price from CoinGecko (free, no API key required)
 */
async function fetchCryptoPrice(symbol: string): Promise<PriceData | null> {
  try {
    // Map common symbols to CoinGecko IDs
    const symbolMap: Record<string, string> = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'USDT': 'tether',
      'BNB': 'binancecoin',
      'SOL': 'solana',
      'XRP': 'ripple',
      'USDC': 'usd-coin',
      'ADA': 'cardano',
      'DOGE': 'dogecoin',
      'TRX': 'tron',
      'TON': 'the-open-network',
      'LINK': 'chainlink',
      'MATIC': 'matic-network',
      'DOT': 'polkadot',
      'UNI': 'uniswap',
      'AVAX': 'avalanche-2',
      'SHIB': 'shiba-inu',
      'LTC': 'litecoin',
      'BCH': 'bitcoin-cash',
      'ATOM': 'cosmos',
      'XLM': 'stellar',
      'ALGO': 'algorand',
      'FIL': 'filecoin',
      'APT': 'aptos',
      'ARB': 'arbitrum',
      'OP': 'optimism',
      'INJ': 'injective-protocol'
    };

    const coinId = symbolMap[symbol.toUpperCase()] || symbol.toLowerCase();
    
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`,
      {
        headers: {
          'Accept': 'application/json',
        }
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const coinData = data[coinId];

    if (!coinData || !coinData.usd) {
      return null;
    }

    return {
      symbol: symbol.toUpperCase(),
      price: coinData.usd,
      change24h: coinData.usd_24h_change,
      type: 'crypto',
      source: 'CoinGecko'
    };
  } catch (error) {
    console.error(`Failed to fetch crypto price for ${symbol}:`, error);
    return null;
  }
}

/**
 * Fetch stock price from Alpha Vantage API
 * Note: Free tier limited to 25 requests/day. Falls back to Yahoo Finance if needed.
 */
async function fetchStockPrice(symbol: string): Promise<PriceData | null> {
  try {
    // Try Yahoo Finance first (free, no API key)
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}`,
      {
        headers: {
          'Accept': 'application/json',
        }
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const result = data?.chart?.result?.[0];
    
    if (!result || !result.meta) {
      return null;
    }

    const currentPrice = result.meta.regularMarketPrice;
    const previousClose = result.meta.chartPreviousClose;
    const change = previousClose ? ((currentPrice - previousClose) / previousClose) * 100 : undefined;

    return {
      symbol: symbol.toUpperCase(),
      price: currentPrice,
      change24h: change,
      type: 'stock',
      source: 'Yahoo Finance'
    };
  } catch (error) {
    console.error(`Failed to fetch stock price for ${symbol}:`, error);
    return null;
  }
}

/**
 * Try to fetch price from both crypto and stock sources
 */
async function fetchPrice(symbol: string): Promise<PriceData | null> {
  // Try crypto first (more common for this use case)
  const cryptoPrice = await fetchCryptoPrice(symbol);
  if (cryptoPrice) {
    return cryptoPrice;
  }

  // Fall back to stock
  const stockPrice = await fetchStockPrice(symbol);
  if (stockPrice) {
    return stockPrice;
  }

  return null;
}

/**
 * Format price data into a readable message
 */
function formatPriceMessage(prices: PriceData[]): string {
  if (prices.length === 0) {
    return "Couldn't find price data for the requested ticker(s).";
  }

  const lines = prices.map(p => {
    const formattedPrice = p.price < 1 
      ? p.price.toFixed(6) 
      : p.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    const changeStr = p.change24h !== undefined
      ? ` (${p.change24h >= 0 ? '+' : ''}${p.change24h.toFixed(2)}%)`
      : '';
    
    const typeLabel = p.type === 'crypto' ? '₿' : '📈';
    
    return `${typeLabel} $${p.symbol}: $${formattedPrice}${changeStr}`;
  });

  return lines.join('\n');
}

/**
 * Extract ticker symbols from message content
 */
function extractTickers(content: string): string[] {
  const tickers = new Set<string>();
  let match;
  
  while ((match = TICKER_PATTERN.exec(content)) !== null) {
    // Check both capture groups ($(SYMBOL) or $SYMBOL)
    const ticker = match[1] || match[2];
    if (ticker) {
      tickers.add(ticker);
    }
  }
  
  return Array.from(tickers);
}

/**
 * Post a message to chat as PriceBot
 */
async function postPriceBotMessage(content: string) {
  try {
    const messageId = `pricebot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    await blink.db.chatMessages.create({
      id: messageId,
      userId: PRICE_BOT_USER_ID,
      username: PRICE_BOT_USERNAME,
      content,
      isBot: 1,
      createdAt: new Date().toISOString()
    });

    // Keep PriceBot's activity updated so it shows as online when active
    const activity = await blink.db.chatActivity.list({
      where: { userId: PRICE_BOT_USER_ID },
      limit: 1
    });
    
    if (activity && activity.length > 0) {
      await blink.db.chatActivity.update(activity[0].id, {
        lastActivity: new Date().toISOString()
      });
    } else {
      await blink.db.chatActivity.create({
        id: `activity-${PRICE_BOT_USER_ID}`,
        userId: PRICE_BOT_USER_ID,
        username: PRICE_BOT_USERNAME,
        lastActivity: new Date().toISOString()
      });
    }

    return true;
  } catch (error) {
    console.error('Failed to post PriceBot message:', error);
    return false;
  }
}

/**
 * Process a message and respond with prices if tickers are found
 */
async function processMessage(messageContent: string): Promise<boolean> {
  const tickers = extractTickers(messageContent);
  
  if (tickers.length === 0) {
    return false; // No tickers found
  }

  // Limit to 5 tickers per message to avoid spam
  const tickersToProcess = tickers.slice(0, 5);
  
  // Fetch prices concurrently
  const pricePromises = tickersToProcess.map(ticker => fetchPrice(ticker));
  const prices = await Promise.all(pricePromises);
  
  // Filter out null results
  const validPrices = prices.filter((p): p is PriceData => p !== null);
  
  if (validPrices.length > 0) {
    const message = formatPriceMessage(validPrices);
    await postPriceBotMessage(message);
    return true;
  } else {
    // All lookups failed
    await postPriceBotMessage(`Couldn't find price data for: ${tickersToProcess.join(', ')}`);
    return true;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const { action, message } = await req.json();

    if (action === 'process-message') {
      const processed = await processMessage(message);
      
      return new Response(JSON.stringify({ 
        processed,
        botName: PRICE_BOT_USERNAME
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    if (action === 'test-ticker') {
      // Test endpoint for manual ticker lookup
      const tickers = extractTickers(message);
      
      if (tickers.length === 0) {
        return new Response(JSON.stringify({ 
          error: 'No tickers found in message'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      const ticker = tickers[0];
      const price = await fetchPrice(ticker);
      
      return new Response(JSON.stringify({ 
        ticker,
        price,
        found: price !== null
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('PriceBot error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: String(error) 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});
