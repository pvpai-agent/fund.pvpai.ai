'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

interface AnalysisData {
  confidence: number;
  direction: string;
  reason: string;
  technicalSummary: string;
  matchedHeadlines: string[];
  shouldTrade: boolean;
  analyzedAt: string;
}

export interface OpenPosition {
  id: string;
  symbol: string;
  direction: string;
  size: number;
  leverage: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  pnlPct: number;
  openedAt: string;
  triggerReason: string | null;
  triggerData?: Record<string, unknown> | null;
}

interface FeedData {
  asset: string;
  price: number;
  priceChange: number;
  rangeHigh: number;
  rangeLow: number;
  candles: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>;
  agent: { status: string; energy: number; capital: number; totalPnl: number; creatorEarnings: number };
  openPositions: OpenPosition[];
  totalUnrealizedPnl: number;
  analysis: AnalysisData | null;
}

interface TradeRecord {
  id: string;
  symbol: string;
  direction: string;
  status: string;
  entry_price?: number | string | null;
  exit_price?: number | string | null;
  realized_pnl?: number | string | null;
  leverage?: number | string;
  opened_at: string;
  closed_at?: string | null;
  trigger_reason?: string | null;
  trigger_data?: Record<string, unknown> | null;
}

interface UseTerminalConfig {
  agentId: string;
  enabled: boolean;
  /** Recent trades to show as historical logs on load */
  trades?: TradeRecord[];
}

/** Generate historical-looking log lines from past trades */
function generateHistoryLogs(trades: TradeRecord[]): string[] {
  const logs: string[] = [];
  const recent = [...trades].reverse().slice(0, 5).reverse();

  for (const trade of recent) {
    const time = new Date(trade.opened_at).toLocaleTimeString('en-US', { hour12: false });
    const symbol = (trade.symbol ?? 'BTC').replace('xyz:', '');
    const dir = trade.direction === 'long' ? 'LONG' : 'SHORT';
    const lev = trade.leverage ? `${trade.leverage}x` : '';
    const entry = Number(trade.entry_price ?? 0);

    const triggerData = trade.trigger_data as { matchedHeadlines?: string[]; confidence?: number } | null;
    if (triggerData?.confidence) {
      logs.push(`[${time}] [AI ${triggerData.confidence}%] ${dir} ${symbol} ${lev} @ $${entry.toFixed(2)}`);
    } else {
      logs.push(`[${time}] [TRIGGER] ${dir} ${symbol} ${lev} @ $${entry.toFixed(2)}`);
    }

    if (triggerData?.matchedHeadlines && triggerData.matchedHeadlines.length > 0) {
      for (const headline of triggerData.matchedHeadlines.slice(0, 2)) {
        const truncated = headline.length > 70 ? headline.slice(0, 67) + '...' : headline;
        logs.push(`[${time}]   \u25B8 ${truncated}`);
      }
    }

    if (trade.status === 'closed' && trade.realized_pnl != null) {
      const pnl = Number(trade.realized_pnl);
      const closeTime = trade.closed_at
        ? new Date(trade.closed_at).toLocaleTimeString('en-US', { hour12: false })
        : time;
      const exitPrice = Number(trade.exit_price ?? 0);
      const tag = pnl >= 0 ? '[PROFIT]' : '[LOSS]';
      const sign = pnl >= 0 ? '+' : '';
      logs.push(`[${closeTime}] ${tag} Closed @ $${exitPrice.toFixed(2)} \u2192 ${sign}$${pnl.toFixed(2)}`);
    }
  }

  return logs;
}

export interface LiveAnalysis {
  confidence: number;
  direction: string;
  reason: string;
  technicalSummary: string;
  matchedHeadlines: string[];
  shouldTrade: boolean;
  analyzedAt: string;
}

export interface LiveCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LiveData {
  price: number;
  priceChange: number;
  asset: string;
  assets: string[];
  candles: LiveCandle[];
  openPositions: OpenPosition[];
  totalUnrealizedPnl: number;
  totalPnl: number;
  capital: number;
  energy: number;
  creatorEarnings: number;
  analysis: LiveAnalysis | null;
}

export function useTerminal(config?: UseTerminalConfig) {
  const [logs, setLogs] = useState<string[]>([
    '[SYSTEM] PVPAI OS online. AI web search enabled.',
    '',
  ]);
  const [liveData, setLiveData] = useState<LiveData | null>(null);
  const feedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const monitorIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const historyLoadedRef = useRef(false);
  const lastAnalysisAtRef = useRef<string | null>(null);
  const pollCountRef = useRef(0);
  const monitorRunningRef = useRef(false);

  // Load historical trade logs once when trades data arrives
  useEffect(() => {
    if (config?.trades && config.trades.length > 0 && !historyLoadedRef.current) {
      historyLoadedRef.current = true;
      const historyLogs = generateHistoryLogs(config.trades);
      if (historyLogs.length > 0) {
        setLogs((prev) => [
          prev[0],
          '',
          ...historyLogs,
          '',
          '\u2500\u2500\u2500 LIVE \u2500\u2500\u2500',
          '',
        ]);
      }
    }
  }, [config?.trades]);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs((prev) => [...prev.slice(-149), `[${timestamp}] ${message}`]);
  }, []);

  const addLogRaw = useCallback((message: string) => {
    setLogs((prev) => [...prev.slice(-149), message]);
  }, []);

  /** Show AI analysis block in terminal */
  const showAnalysisBlock = useCallback((analysis: AnalysisData, asset: string) => {
    addLogRaw('');
    addLog('\u2501\u2501\u2501 AI ANALYSIS \u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501');

    const dirLabel = analysis.direction.toUpperCase();
    const tradeLabel = analysis.shouldTrade ? `\u26A1 SIGNAL: ${dirLabel}` : '\u23F8 HOLD';
    addLog(`[DECISION] ${tradeLabel} ${asset} | AI Confidence: ${analysis.confidence}%`);

    if (analysis.reason) {
      addLog(`[REASON] ${analysis.reason}`);
    }

    if (analysis.technicalSummary) {
      addLog(`[TECHNICAL] ${analysis.technicalSummary}`);
    }

    if (analysis.matchedHeadlines && analysis.matchedHeadlines.length > 0) {
      addLog(`[WEB SEARCH] Found ${analysis.matchedHeadlines.length} relevant articles:`);
      for (const headline of analysis.matchedHeadlines.slice(0, 5)) {
        const truncated = headline.length > 80 ? headline.slice(0, 77) + '...' : headline;
        addLog(`  \u25B8 ${truncated}`);
      }
    }

    addLog('\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501');
    addLogRaw('');
  }, [addLog, addLogRaw]);

  /** Trigger the single-agent monitor: AI web search + analysis + trade execution */
  const triggerMonitor = useCallback(async () => {
    if (!config?.agentId || monitorRunningRef.current) return;
    monitorRunningRef.current = true;

    addLog('[AI] Running web search + analysis...');

    try {
      const res = await fetch(`/api/agent/${config.agentId}/monitor`, {
        method: 'POST',
      });
      if (!res.ok) {
        addLog('[AI] Analysis request failed');
        monitorRunningRef.current = false;
        return;
      }
      const json = await res.json();
      if (!json.success || !mountedRef.current) {
        monitorRunningRef.current = false;
        return;
      }

      const data = json.data;

      // Check if this was skipped (too soon based on tier frequency)
      if (data.skipped) {
        addLog(`[SYSTEM] Next analysis in ${data.nextCheckIn}s`);
        monitorRunningRef.current = false;
        return;
      }

      // Agent died?
      if (data.died) {
        addLog('[ERROR] Agent ran out of fuel!');
        monitorRunningRef.current = false;
        return;
      }

      // Show analysis results (only if has real content)
      if (data.analysis && data.analysis.confidence > 0) {
        showAnalysisBlock(data.analysis, '');
        lastAnalysisAtRef.current = data.analysis.analyzedAt;
      } else if (data.signals && data.signals.length > 0) {
        for (const sig of data.signals) {
          const asset = sig.asset?.replace('xyz:', '') ?? 'BTC';
          addLog(`[SIGNAL] ${asset} | ${sig.direction.toUpperCase()} | Confidence: ${sig.confidence}% — ${sig.reason}`);
        }
      }

      // Show trade actions
      if (data.tradesOpened > 0) {
        addLog(`[EXEC] Opened ${data.tradesOpened} new position${data.tradesOpened > 1 ? 's' : ''}`);
      }
      if (data.tradesClosed > 0) {
        addLog(`[EXEC] Closed ${data.tradesClosed} position${data.tradesClosed > 1 ? 's' : ''} (SL/TP hit)`);
      }

      // Show errors
      if (data.errors && data.errors.length > 0) {
        for (const err of data.errors) {
          addLog(`[WARN] ${err}`);
        }
      }
    } catch {
      addLog('[ERROR] Monitor request failed');
    } finally {
      monitorRunningRef.current = false;
    }
  }, [config?.agentId, addLog, showAnalysisBlock]);

  const startPolling = useCallback(() => {
    if (feedIntervalRef.current) return;
    if (!config?.agentId || !config?.enabled) return;

    // Feed poll: lightweight data refresh (price, positions, cached analysis)
    const feedPoll = async () => {
      try {
        const res = await fetch(`/api/agent/${config.agentId}/feed`);
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          addLog(`[ERROR] Feed failed (${res.status}): ${errText.slice(0, 80)}`);
          // Still trigger monitor on first attempt even if feed fails
          if (pollCountRef.current === 0) {
            pollCountRef.current++;
            addLog('[SYSTEM] Starting AI monitor (feed unavailable)...');
            triggerMonitor();
          }
          return;
        }
        const json = await res.json();
        if (!json.success || !mountedRef.current) return;

        const feed: FeedData = json.data;
        const asset = feed.asset || 'BTC';
        const sign = feed.priceChange >= 0 ? '+' : '';
        pollCountRef.current++;
        const isFirstPoll = pollCountRef.current === 1;

        // Update live data for UI — preserve good analysis if new one is empty
        const newAnalysis = feed.analysis ?? null;
        const analysisHasContent = newAnalysis && (
          newAnalysis.confidence > 0 ||
          (newAnalysis.matchedHeadlines && newAnalysis.matchedHeadlines.length > 0) ||
          (newAnalysis.technicalSummary && newAnalysis.technicalSummary.length > 0)
        );

        setLiveData((prev) => ({
          price: feed.price,
          priceChange: feed.priceChange ?? 0,
          asset,
          assets: (feed as { assets?: string[] }).assets ?? [asset],
          candles: feed.candles ?? [],
          openPositions: feed.openPositions ?? [],
          totalUnrealizedPnl: feed.totalUnrealizedPnl ?? 0,
          totalPnl: feed.agent.totalPnl ?? 0,
          capital: feed.agent.capital ?? 0,
          energy: feed.agent.energy ?? 0,
          creatorEarnings: feed.agent.creatorEarnings ?? 0,
          // Keep previous good analysis if the new one is empty/error
          analysis: analysisHasContent ? newAnalysis : (prev?.analysis ?? newAnalysis),
        }));

        if (isFirstPoll) {
          addLog(`[PRICE] ${asset} $${feed.price.toFixed(2)} (${sign}${feed.priceChange.toFixed(2)}%)`);
          addLog(`[STATUS] Capital: $${feed.agent.capital.toFixed(0)} | Fuel: ${feed.agent.energy.toFixed(0)} PVP`);

          // Show cached analysis if available
          if (feed.analysis) {
            showAnalysisBlock(feed.analysis, asset);
            lastAnalysisAtRef.current = feed.analysis.analyzedAt;
          }

          // Immediately trigger the first monitor check (AI search + analysis)
          addLog('[SYSTEM] Starting AI monitor...');
          triggerMonitor();
          return;
        }

        // Subsequent polls: show new analysis only if it has real content
        if (feed.analysis && feed.analysis.confidence > 0) {
          const isNewAnalysis = feed.analysis.analyzedAt !== lastAnalysisAtRef.current;
          if (isNewAnalysis) {
            lastAnalysisAtRef.current = feed.analysis.analyzedAt;
            showAnalysisBlock(feed.analysis, asset);
          }
        }

        // Price — every 3rd poll
        if (pollCountRef.current % 3 === 0) {
          addLog(`[PRICE] ${asset} $${feed.price.toFixed(2)} (${sign}${feed.priceChange.toFixed(2)}%)`);
        }

        // Candle — every 4th poll
        if (pollCountRef.current % 4 === 0 && feed.candles.length > 0) {
          const last = feed.candles[feed.candles.length - 1];
          const dir = last.close >= last.open ? '\u25B2' : '\u25BC';
          addLog(`[K-LINE] ${dir} O:${last.open.toFixed(2)} H:${last.high.toFixed(2)} L:${last.low.toFixed(2)} C:${last.close.toFixed(2)}`);
        }

        // Heartbeat — every 6th poll
        if (pollCountRef.current % 6 === 0) {
          addLog(`[HEARTBEAT] ${feed.agent.status} | Fuel: ${feed.agent.energy.toFixed(0)} PVP | Capital: $${feed.agent.capital.toFixed(0)}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        addLog(`[ERROR] Feed: ${msg.slice(0, 80)}`);
        // Still trigger monitor on first attempt
        if (pollCountRef.current === 0) {
          pollCountRef.current++;
          addLog('[SYSTEM] Starting AI monitor (feed error)...');
          triggerMonitor();
        }
      }
    };

    // Start feed polling: immediately, then every 15s
    feedPoll();
    feedIntervalRef.current = setInterval(feedPoll, 15_000);

    // Start monitor loop: trigger AI analysis every 5 minutes (for sniper tier)
    // The server-side will enforce the actual tier frequency limit
    monitorIntervalRef.current = setInterval(() => {
      triggerMonitor();
    }, 5 * 60_000); // 5 minutes

  }, [config?.agentId, config?.enabled, addLog, addLogRaw, showAnalysisBlock, triggerMonitor]);

  const stopPolling = useCallback(() => {
    if (feedIntervalRef.current) {
      clearInterval(feedIntervalRef.current);
      feedIntervalRef.current = null;
    }
    if (monitorIntervalRef.current) {
      clearInterval(monitorIntervalRef.current);
      monitorIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (config?.enabled && config?.agentId) {
      startPolling();
    }
    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [config?.enabled, config?.agentId, startPolling, stopPolling]);

  return { logs, addLog, stopPolling, liveData };
}
