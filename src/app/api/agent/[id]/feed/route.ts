import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUserByWallet } from '@/services/user.service';
import { getAgentById } from '@/services/agent.service';
import { getMarkPrice, getCandleData, type CandleData } from '@/lib/hyperliquid/trading';
import { mockGetAgentAnalysisLogs } from '@/lib/mock-db';

/**
 * Lightweight live-feed endpoint for terminal polling.
 * Returns: current price (for agent's asset), recent candles, agent status,
 * and the latest AI analysis results (with web search news).
 * 10-second server-side cache per asset.
 */

interface FeedCache {
  price: number;
  candles: CandleData[];
  fetchedAt: number;
}

const globalForFeed = globalThis as unknown as { __feedCacheMap?: Map<string, FeedCache> };
if (!globalForFeed.__feedCacheMap) globalForFeed.__feedCacheMap = new Map();
const FEED_CACHE_TTL = 10_000; // 10 seconds

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const user = await getUserByWallet(auth.wallet);
  if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });

  const { id } = await params;
  const agent = await getAgentById(id);
  if (!agent) return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });
  if (agent.user_id !== user.id) return NextResponse.json({ success: false, error: 'Not your agent' }, { status: 403 });

  try {
    // Use agent's own asset for price data
    const agentAsset = agent.parsed_rules?.asset ?? 'BTC';
    const cacheKey = agentAsset;
    let feedData: FeedCache;

    // Use cached data if fresh enough (per asset)
    const cached = globalForFeed.__feedCacheMap!.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < FEED_CACHE_TTL) {
      feedData = cached;
    } else {
      const [price, candles] = await Promise.all([
        getMarkPrice(agentAsset),
        getCandleData(agentAsset, '5m', 6),
      ]);
      feedData = { price, candles, fetchedAt: Date.now() };
      globalForFeed.__feedCacheMap!.set(cacheKey, feedData);
    }

    // Compute price change from candles
    let priceChange = 0;
    if (feedData.candles.length >= 2) {
      const oldest = feedData.candles[0].open;
      if (oldest > 0) {
        priceChange = ((feedData.price - oldest) / oldest) * 100;
      }
    }

    // Candle range (high/low across recent candles)
    const highs = feedData.candles.map((c) => c.high);
    const lows = feedData.candles.map((c) => c.low);
    const rangeHigh = highs.length > 0 ? Math.max(...highs) : 0;
    const rangeLow = lows.length > 0 ? Math.min(...lows) : 0;

    // Get latest AI analysis for this agent (from monitor cron logs)
    const recentAnalysis = mockGetAgentAnalysisLogs(id, 1);
    const latestAnalysis = recentAnalysis[0] ?? null;

    return NextResponse.json({
      success: true,
      data: {
        asset: agentAsset.replace('xyz:', ''),
        price: feedData.price,
        priceChange,
        rangeHigh,
        rangeLow,
        candles: feedData.candles.map((c) => ({
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
        })),
        agent: {
          status: agent.status,
          energy: Number(agent.energy_balance),
          capital: Number(agent.capital_balance),
        },
        // Latest AI analysis with web search results
        analysis: latestAnalysis ? {
          confidence: latestAnalysis.confidence,
          direction: latestAnalysis.direction,
          reason: latestAnalysis.reason,
          technicalSummary: latestAnalysis.technical_summary,
          matchedHeadlines: latestAnalysis.matched_headlines,
          shouldTrade: latestAnalysis.should_trade,
          analyzedAt: latestAnalysis.created_at,
        } : null,
      },
    });
  } catch (error) {
    console.error('[FEED] Error:', error);
    return NextResponse.json({ success: false, error: 'Feed fetch failed' }, { status: 500 });
  }
}
