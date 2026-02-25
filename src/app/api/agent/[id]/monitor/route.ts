import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, rateLimit } from '@/lib/auth';
import { getUserByWallet } from '@/services/user.service';
import { getAgentById } from '@/services/agent.service';
import { openTrade, getTradesByAgent } from '@/services/trade.service';
import { burnEnergy, checkDeath } from '@/services/metabolism.service';
import { getMarkPrice, getCandleData, getPositions, closePosition } from '@/lib/hyperliquid/trading';
import { evaluateSignalWithAI } from '@/lib/claude/signal-evaluator';
import { TRADING, AGENT_TIERS } from '@/constants/trading';
import type { AgentTier } from '@/constants/trading';
import { mockAddAnalysisLog, mockGetAgentAnalysisLogs } from '@/lib/mock-db';
import { getAgentAssets } from '@/types/database';

/**
 * Single-agent monitor endpoint.
 * Called periodically by the client terminal to trigger AI analysis + trading
 * for one specific agent. This replaces the need for a server-side cron job.
 *
 * Rate-limited by the agent's tier frequency (e.g. 12 checks/hr for Sniper).
 */

// Per-agent last-check timestamp to enforce frequency limits
const globalForMonitor = globalThis as unknown as { __agentLastCheck?: Map<string, number> };
if (!globalForMonitor.__agentLastCheck) globalForMonitor.__agentLastCheck = new Map();

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Rate limit: max 30 requests per minute per IP
  const limited = rateLimit(req, 30, 60_000);
  if (limited) return limited;

  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const user = await getUserByWallet(auth.wallet);
  if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });

  const { id } = await params;
  const agent = await getAgentById(id);
  if (!agent) return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });
  if (agent.user_id !== user.id) return NextResponse.json({ success: false, error: 'Not your agent' }, { status: 403 });
  if (agent.status !== 'active') return NextResponse.json({ success: false, error: 'Agent not active' }, { status: 400 });

  // Enforce tier frequency: don't run more often than the tier allows
  const tier = AGENT_TIERS[(agent.parsed_rules?.tier as AgentTier) ?? 'sniper'];
  const minIntervalMs = (3600 / tier.frequency) * 1000; // e.g. 300_000ms for 12/hr
  const lastCheck = globalForMonitor.__agentLastCheck!.get(id) ?? 0;
  const elapsed = Date.now() - lastCheck;

  if (elapsed < minIntervalMs * 0.8) {
    // Too soon — return the last analysis without re-running
    return NextResponse.json({
      success: true,
      data: { skipped: true, reason: 'Too soon', nextCheckIn: Math.ceil((minIntervalMs - elapsed) / 1000) },
    });
  }

  globalForMonitor.__agentLastCheck!.set(id, Date.now());

  try {
    const results: {
      tradesOpened: number;
      tradesClosed: number;
      analysis: unknown;
      signals: Array<{ asset: string; direction: string; confidence: number; reason: string }>;
      errors: string[];
    } = { tradesOpened: 0, tradesClosed: 0, analysis: null, signals: [], errors: [] };

    // 1) Metabolism heartbeat: burn energy
    const { isDead } = await burnEnergy(agent.id, 'heartbeat');
    if (isDead) {
      await checkDeath(agent.id);
      return NextResponse.json({
        success: true,
        data: { died: true, message: 'Agent ran out of fuel' },
      });
    }

    // 2) Check stop-loss / take-profit on open positions
    let openTrades: Awaited<ReturnType<typeof getTradesByAgent>> = [];
    try {
      const allTrades = await getTradesByAgent(id);
      openTrades = allTrades.filter((t) => t.status === 'open');
    } catch (err) {
      results.errors.push(`Trades fetch: ${err instanceof Error ? err.message : 'Supabase unavailable'}`);
    }

    if (openTrades.length > 0) {
      try {
        const [stdPositions, xyzPositions] = await Promise.all([
          getPositions(),
          getPositions('xyz'),
        ]);
        const hlPositions = [...stdPositions, ...xyzPositions];
        const positionMap = new Map(hlPositions.map((p) => [p.symbol, p]));

        for (const trade of openTrades) {
          const hlPos = positionMap.get(trade.symbol);
          if (!hlPos || hlPos.size === 0) continue;

          const entryPrice = Number(trade.entry_price);
          if (!entryPrice) continue;

          const currentPrice = hlPos.entryPrice > 0
            ? hlPos.entryPrice + (hlPos.unrealizedPnl / hlPos.size)
            : await getMarkPrice(trade.symbol);

          const leverage = trade.leverage || 1;
          const pnlPct = trade.direction === 'long'
            ? ((currentPrice - entryPrice) / entryPrice) * 100 * leverage
            : ((entryPrice - currentPrice) / entryPrice) * 100 * leverage;

          const rules = agent.parsed_rules.risk_management;

          if (pnlPct <= -rules.stop_loss_pct) {
            await closePosition(trade.symbol, hlPos.size, trade.direction === 'long');
            results.tradesClosed++;
          } else if (pnlPct >= rules.take_profit_pct) {
            await closePosition(trade.symbol, hlPos.size, trade.direction === 'long');
            results.tradesClosed++;
          }
        }
      } catch (err) {
        results.errors.push(`SL/TP check: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }

    // 3) AI analysis for each asset
    const agentAssets = getAgentAssets(agent.parsed_rules);

    for (const agentAsset of agentAssets) {
      let price: number;
      let candles: Awaited<ReturnType<typeof getCandleData>> = [];

      try {
        [price, candles] = await Promise.all([
          getMarkPrice(agentAsset),
          getCandleData(agentAsset, '1h', 24),
        ]);
      } catch (err) {
        results.errors.push(`Market data for ${agentAsset}: ${err instanceof Error ? err.message : 'Unknown'}`);
        continue;
      }

      // Run AI web search + analysis
      const aiSignal = await evaluateSignalWithAI(agent.parsed_rules, price, candles, agentAsset);

      // Only store analysis when AI returned meaningful content.
      // Don't let error/empty results overwrite a previous good analysis.
      const hasContent = aiSignal && (
        aiSignal.confidence > 0 ||
        aiSignal.matchedHeadlines.length > 0 ||
        aiSignal.technicalSummary.length > 0
      );

      if (hasContent) {
        const analysisLog = mockAddAnalysisLog({
          agent_id: agent.id,
          agent_name: agent.name,
          price,
          news_count: aiSignal.matchedHeadlines.length,
          candle_count: candles.length,
          confidence: aiSignal.confidence,
          direction: aiSignal.direction,
          reason: aiSignal.reason,
          technical_summary: aiSignal.technicalSummary,
          matched_headlines: aiSignal.matchedHeadlines,
          should_trade: aiSignal.shouldTrade,
        });

        results.analysis = {
          confidence: analysisLog.confidence,
          direction: analysisLog.direction,
          reason: analysisLog.reason,
          technicalSummary: analysisLog.technical_summary,
          matchedHeadlines: analysisLog.matched_headlines,
          shouldTrade: analysisLog.should_trade,
          analyzedAt: analysisLog.created_at,
        };
      }

      results.signals.push({
        asset: agentAsset,
        direction: aiSignal?.direction ?? 'long',
        confidence: aiSignal?.confidence ?? 0,
        reason: aiSignal?.reason ?? 'No actionable signal',
      });

      // Only open trade if AI recommends it (confidence >= 70, shouldTrade=true)
      if (aiSignal?.shouldTrade) {
        const positionSizePct = agent.parsed_rules.risk_management.max_position_size_pct;
        const sizeUsd = (Number(agent.capital_balance) * positionSizePct) / 100;

        if (sizeUsd >= TRADING.MIN_TRADE_SIZE_USD) {
          await burnEnergy(agent.id, 'trade_open');
          await openTrade({
            agentId: agent.id,
            userId: agent.user_id,
            direction: aiSignal.direction,
            sizeUsd: Math.min(sizeUsd, TRADING.MAX_TRADE_SIZE_USD),
            leverage: agent.parsed_rules.risk_management.max_leverage,
            triggerReason: `[AI ${aiSignal.confidence}%] ${aiSignal.reason}`,
            triggerData: {
              confidence: aiSignal.confidence,
              matchedHeadlines: aiSignal.matchedHeadlines,
              technicalSummary: aiSignal.technicalSummary ?? '',
              dataSources: agent.parsed_rules.data_sources ?? ['hl_kline', 'ai_web_search'],
              price,
              analyzedAt: new Date().toISOString(),
            },
            symbol: agentAsset,
          });
          results.tradesOpened++;
        } else {
          results.errors.push(`Insufficient capital for trade on ${agentAsset}`);
        }
      }
    }

    // If no new analysis was stored this run, return the best existing one
    if (!results.analysis) {
      const existing = mockGetAgentAnalysisLogs(id, 1);
      if (existing[0]) {
        results.analysis = {
          confidence: existing[0].confidence,
          direction: existing[0].direction,
          reason: existing[0].reason,
          technicalSummary: existing[0].technical_summary,
          matchedHeadlines: existing[0].matched_headlines,
          shouldTrade: existing[0].should_trade,
          analyzedAt: existing[0].created_at,
        };
      }
    }

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error('[MONITOR] Single agent error:', error);
    return NextResponse.json({ success: false, error: 'Monitor check failed' }, { status: 500 });
  }
}
