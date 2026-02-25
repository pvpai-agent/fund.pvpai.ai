import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUserByWallet } from '@/services/user.service';
import { getAgentById } from '@/services/agent.service';
import { getTradesByAgent } from '@/services/trade.service';
import { getMarkPrice, getCandleData, type CandleData } from '@/lib/hyperliquid/trading';
import { mockGetAgentAnalysisLogs } from '@/lib/mock-db';
import { getAgentAssets } from '@/types/database';

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
    // Get all agent assets; use first as "primary" for display, but fetch all for positions
    const agentAssets = getAgentAssets(agent.parsed_rules);
    const primaryAsset = agentAssets[0];

    // Fetch price data for all assets (cached per asset, individual error handling)
    const assetDataMap = new Map<string, FeedCache>();
    await Promise.all(
      agentAssets.map(async (asset) => {
        try {
          const cached = globalForFeed.__feedCacheMap!.get(asset);
          if (cached && Date.now() - cached.fetchedAt < FEED_CACHE_TTL) {
            assetDataMap.set(asset, cached);
          } else {
            const [price, candles] = await Promise.all([
              getMarkPrice(asset),
              getCandleData(asset, '5m', 6),
            ]);
            const data = { price, candles, fetchedAt: Date.now() };
            globalForFeed.__feedCacheMap!.set(asset, data);
            assetDataMap.set(asset, data);
          }
        } catch (err) {
          console.error(`[FEED] Failed to fetch ${asset}:`, err instanceof Error ? err.message : err);
          // Use stale cache if available, otherwise use fallback price 0
          const stale = globalForFeed.__feedCacheMap!.get(asset);
          if (stale) {
            assetDataMap.set(asset, stale);
          } else {
            assetDataMap.set(asset, { price: 0, candles: [], fetchedAt: 0 });
          }
        }
      })
    );

    const primaryData = assetDataMap.get(primaryAsset) ?? { price: 0, candles: [], fetchedAt: 0 };

    // Compute price change from primary asset candles
    let priceChange = 0;
    if (primaryData.candles.length >= 2) {
      const oldest = primaryData.candles[0].open;
      if (oldest > 0) {
        priceChange = ((primaryData.price - oldest) / oldest) * 100;
      }
    }

    // Candle range (high/low across recent candles)
    const highs = primaryData.candles.map((c) => c.high);
    const lows = primaryData.candles.map((c) => c.low);
    const rangeHigh = highs.length > 0 ? Math.max(...highs) : 0;
    const rangeLow = lows.length > 0 ? Math.min(...lows) : 0;

    // Get latest AI analysis with actual content (not empty/error results)
    let latestAnalysis = null;
    try {
      const recentAnalysis = mockGetAgentAnalysisLogs(id, 5);
      latestAnalysis = recentAnalysis.find(
        (a) => a.confidence > 0 || a.matched_headlines.length > 0 || a.technical_summary.length > 0
      ) ?? recentAnalysis[0] ?? null;
    } catch {
      // Analysis logs unavailable — continue without
    }

    // Get open trades for unrealized P&L calculation (Supabase — may fail)
    let openPositions: Array<{
      id: string; symbol: string; direction: string; size: number; leverage: number;
      entryPrice: number; currentPrice: number; unrealizedPnl: number; pnlPct: number;
      openedAt: string; triggerReason: string | null; triggerData: Record<string, unknown> | null;
    }> = [];
    let totalUnrealizedPnl = 0;

    try {
      const allTrades = await getTradesByAgent(id);
      const openTrades = allTrades.filter((t) => t.status === 'open');
      openPositions = openTrades.map((t) => {
        const entryPrice = Number(t.entry_price ?? 0);
        const size = Number(t.size ?? 0);
        const leverage = Number(t.leverage ?? 1);
        const posAssetData = assetDataMap.get(t.symbol) ?? primaryData;
        const currentPrice = posAssetData.price;
        let unrealizedPnl = 0;
        let pnlPct = 0;
        if (entryPrice > 0) {
          if (t.direction === 'long') {
            unrealizedPnl = (currentPrice - entryPrice) * size;
            pnlPct = ((currentPrice - entryPrice) / entryPrice) * 100 * leverage;
          } else {
            unrealizedPnl = (entryPrice - currentPrice) * size;
            pnlPct = ((entryPrice - currentPrice) / entryPrice) * 100 * leverage;
          }
        }
        return {
          id: t.id, symbol: t.symbol, direction: t.direction, size, leverage,
          entryPrice, currentPrice, unrealizedPnl, pnlPct,
          openedAt: t.opened_at, triggerReason: t.trigger_reason, triggerData: t.trigger_data,
        };
      });
      totalUnrealizedPnl = openPositions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
    } catch (err) {
      console.error('[FEED] Trades fetch failed (Supabase):', err instanceof Error ? err.message : err);
      // Continue — feed returns price/candle/analysis even without trade data
    }

    return NextResponse.json({
      success: true,
      data: {
        asset: primaryAsset.replace('xyz:', ''),
        assets: agentAssets.map((a) => a.replace('xyz:', '')),
        price: primaryData.price,
        priceChange,
        rangeHigh,
        rangeLow,
        candles: primaryData.candles.map((c) => ({
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
          totalPnl: Number(agent.total_pnl),
          creatorEarnings: Number(agent.creator_earnings),
        },
        // Open positions with unrealized P&L (uses correct per-asset prices)
        openPositions,
        totalUnrealizedPnl,
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
