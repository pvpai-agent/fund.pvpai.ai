import { getActiveAgents } from './agent.service';
import { openTrade, getOpenTrades } from './trade.service';
import { burnEnergy, checkDeath } from './metabolism.service';
import { getCurrentMarketData, type TradeSignal } from '@/lib/hyperliquid/monitor';
import { getPositions, closePosition, getMarkPrice, getCandleData, type CandleData } from '@/lib/hyperliquid/trading';
import { evaluateSignalWithAI } from '@/lib/claude/signal-evaluator';
import { TRADING } from '@/constants/trading';
import { mockAddAnalysisLog } from '@/lib/mock-db';
import { type Trade, getAgentAssets } from '@/types/database';

export interface MonitorResult {
  agentsChecked: number;
  tradesOpened: number;
  tradesClosed: number;
  agentsDied: number;
  errors: string[];
  signals: Array<{ agentId: string; signal: TradeSignal }>;
}

export async function checkAllActiveAgents(): Promise<MonitorResult> {
  const result: MonitorResult = {
    agentsChecked: 0,
    tradesOpened: 0,
    tradesClosed: 0,
    agentsDied: 0,
    errors: [],
    signals: [],
  };

  const agents = await getActiveAgents();
  result.agentsChecked = agents.length;

  if (agents.length === 0) return result;

  console.log(`[MONITOR] Checking ${agents.length} agents...`);

  // Phase 1: Check stop-loss / take-profit on open positions
  const closedCount = await checkStopLossTakeProfit(result);
  result.tradesClosed = closedCount;

  // Phase 2: Check each agent for new trade signals
  // Each agent fetches its own asset data; Claude uses web_search to find news autonomously
  for (const agent of agents) {
    try {
      // Metabolism heartbeat: burn energy
      const { isDead } = await burnEnergy(agent.id, 'heartbeat');
      if (isDead) {
        const died = await checkDeath(agent.id);
        if (died) {
          result.agentsDied++;
          continue;
        }
      }

      // Fetch candles for each of the agent's assets
      const agentAssets = getAgentAssets(agent.parsed_rules);

      for (const agentAsset of agentAssets) {
        let price: number;
        let candles: CandleData[] = [];

        try {
          const [md, candleData] = await Promise.all([
            getCurrentMarketData(agentAsset),
            getCandleData(agentAsset, '1h', 24),
          ]);
          price = md.price;
          candles = candleData;
        } catch (err) {
          result.errors.push(`Agent ${agent.name}: Failed to get market data for ${agentAsset}: ${err instanceof Error ? err.message : 'Unknown'}`);
          continue;
        }

        console.log(`[MONITOR] Analyzing ${agent.name} | ${agentAsset} @ $${price.toFixed(2)} | ${candles.length} candles`);

        // AI-powered signal evaluation:
        // Claude uses web_search tool to autonomously find relevant news,
        // then combines with K-line candle data to make trading decisions
        const aiSignal = await evaluateSignalWithAI(
          agent.parsed_rules,
          price,
          candles,
          agentAsset
        );

        // Log every analysis result (trade or not) for admin visibility
        mockAddAnalysisLog({
          agent_id: agent.id,
          agent_name: agent.name,
          price,
          news_count: aiSignal?.matchedHeadlines?.length ?? 0,
          candle_count: candles.length,
          confidence: aiSignal?.confidence ?? 0,
          direction: aiSignal?.direction ?? 'long',
          reason: aiSignal?.reason ?? 'No actionable signal',
          technical_summary: aiSignal?.technicalSummary ?? '',
          matched_headlines: aiSignal?.matchedHeadlines ?? [],
          should_trade: !!aiSignal?.shouldTrade,
        });

        if (aiSignal?.shouldTrade) {
          const signal: TradeSignal = {
            direction: aiSignal.direction,
            reason: `[AI ${aiSignal.confidence}%] ${aiSignal.reason}`,
            data: {
              confidence: aiSignal.confidence,
              matchedHeadlines: aiSignal.matchedHeadlines,
              technicalSummary: aiSignal.technicalSummary ?? '',
              dataSources: agent.parsed_rules.data_sources ?? ['hl_kline', 'ai_web_search'],
              price,
              analyzedAt: new Date().toISOString(),
            },
          };
          result.signals.push({ agentId: agent.id, signal });

          const positionSizePct = agent.parsed_rules.risk_management.max_position_size_pct;
          const sizeUsd = (Number(agent.capital_balance) * positionSizePct) / 100;

          if (sizeUsd < TRADING.MIN_TRADE_SIZE_USD) {
            result.errors.push(`Agent ${agent.id}: Insufficient capital for trade (${sizeUsd} USD)`);
            continue;
          }

          await burnEnergy(agent.id, 'trade_open');

          await openTrade({
            agentId: agent.id,
            userId: agent.user_id,
            direction: signal.direction,
            sizeUsd: Math.min(sizeUsd, TRADING.MAX_TRADE_SIZE_USD),
            leverage: agent.parsed_rules.risk_management.max_leverage,
            triggerReason: signal.reason,
            triggerData: signal.data,
            symbol: agentAsset,
          });

          result.tradesOpened++;
          console.log(`[MONITOR] Agent ${agent.name} opened ${signal.direction} on ${agentAsset} — ${signal.reason}`);
        }
      }
    } catch (err) {
      result.errors.push(`Agent ${agent.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  console.log(`[MONITOR] Done: ${result.agentsChecked} agents, ${result.tradesOpened} trades opened, ${result.tradesClosed} closed, ${result.agentsDied} died`);

  return result;
}

/**
 * Check all open trades for stop-loss / take-profit conditions.
 * If triggered, close the position on Hyperliquid.
 */
async function checkStopLossTakeProfit(result: MonitorResult): Promise<number> {
  let closed = 0;

  const openTrades = await getOpenTrades();
  if (openTrades.length === 0) return 0;

  // Get current positions from Hyperliquid (standard + xyz dex)
  const [stdPositions, xyzPositions] = await Promise.all([
    getPositions(),
    getPositions('xyz'),
  ]);
  const hlPositions = [...stdPositions, ...xyzPositions];
  const positionMap = new Map(hlPositions.map((p) => [p.symbol, p]));

  // Build agent rules lookup
  const agents = await getActiveAgents();
  const agentMap = new Map(agents.map((a) => [a.id, a]));

  for (const trade of openTrades) {
    try {
      const hlPos = positionMap.get(trade.symbol);
      if (!hlPos || hlPos.size === 0) continue; // Already closed, settlement will handle

      const agent = agentMap.get(trade.agent_id);
      if (!agent) continue;

      const entryPrice = Number(trade.entry_price);
      if (!entryPrice) continue;

      const currentPrice = hlPos.entryPrice > 0
        ? hlPos.entryPrice + (hlPos.unrealizedPnl / hlPos.size)
        : await getMarkPrice(trade.symbol);

      const pnlPct = calculatePnlPct(trade, currentPrice);
      const rules = agent.parsed_rules.risk_management;

      // Stop-loss check
      if (pnlPct <= -rules.stop_loss_pct) {
        console.log(`[SL] Agent ${agent.name}: ${pnlPct.toFixed(2)}% loss → closing position`);
        await closePosition(
          trade.symbol,
          hlPos.size,
          trade.direction === 'long'
        );
        closed++;
        continue;
      }

      // Take-profit check
      if (pnlPct >= rules.take_profit_pct) {
        console.log(`[TP] Agent ${agent.name}: +${pnlPct.toFixed(2)}% profit → closing position`);
        await closePosition(
          trade.symbol,
          hlPos.size,
          trade.direction === 'long'
        );
        closed++;
      }
    } catch (err) {
      result.errors.push(`SL/TP check failed for trade ${trade.id}: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  return closed;
}

function calculatePnlPct(trade: Trade, currentPrice: number): number {
  const entryPrice = Number(trade.entry_price);
  if (!entryPrice) return 0;

  const leverage = trade.leverage || 1;

  if (trade.direction === 'long') {
    return ((currentPrice - entryPrice) / entryPrice) * 100 * leverage;
  } else {
    return ((entryPrice - currentPrice) / entryPrice) * 100 * leverage;
  }
}
