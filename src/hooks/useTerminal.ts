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

interface FeedData {
  asset: string;
  price: number;
  priceChange: number;
  rangeHigh: number;
  rangeLow: number;
  candles: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>;
  agent: { status: string; energy: number; capital: number };
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
  const recent = [...trades].reverse().slice(0, 10).reverse();

  for (const trade of recent) {
    const time = new Date(trade.opened_at).toLocaleTimeString('en-US', { hour12: false });
    const symbol = (trade.symbol ?? 'BTC').replace('xyz:', '');
    const dir = trade.direction === 'long' ? 'LONG' : 'SHORT';
    const lev = trade.leverage ? `${trade.leverage}x` : '';
    const entry = Number(trade.entry_price ?? 0);

    logs.push(`[${time}] [TRIGGER] AI signal: ${dir} ${symbol} ${lev}`);

    // Show matched headlines from trigger data
    const triggerData = trade.trigger_data as { matchedHeadlines?: string[]; confidence?: number } | null;
    if (triggerData?.matchedHeadlines && triggerData.matchedHeadlines.length > 0) {
      for (const headline of triggerData.matchedHeadlines.slice(0, 3)) {
        const truncated = headline.length > 80 ? headline.slice(0, 77) + '...' : headline;
        logs.push(`[${time}] [NEWS] "${truncated}"`);
      }
    }

    if (trade.trigger_reason) {
      logs.push(`[${time}] [ANALYSIS] ${trade.trigger_reason}`);
    }

    if (entry > 0) {
      logs.push(`[${time}] [EXEC] ${dir} ${symbol} @ $${entry.toFixed(2)} ${lev}`);
    }

    if (trade.status === 'closed' && trade.realized_pnl != null) {
      const pnl = Number(trade.realized_pnl);
      const closeTime = trade.closed_at
        ? new Date(trade.closed_at).toLocaleTimeString('en-US', { hour12: false })
        : time;
      const exitPrice = Number(trade.exit_price ?? 0);
      const tag = pnl >= 0 ? '[PROFIT]' : '[LOSS]';
      const sign = pnl >= 0 ? '+' : '';
      logs.push(`[${closeTime}] ${tag} Closed ${symbol} @ $${exitPrice.toFixed(2)} \u2192 ${sign}$${pnl.toFixed(2)}`);
    }

    logs.push('');
  }

  return logs;
}

export function useTerminal(config?: UseTerminalConfig) {
  const [logs, setLogs] = useState<string[]>([
    '[BOOT] PVP AI Agent System v1.0.0',
    '[BOOT] Initializing neural network...',
    '[BOOT] Connecting to Hyperliquid...',
    '[BOOT] Claude AI web search: enabled',
    '[BOOT] System ready.',
    '',
  ]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const historyLoadedRef = useRef(false);
  const lastAnalysisAtRef = useRef<string | null>(null);
  const pollCountRef = useRef(0);

  // Load historical trade logs once when trades data arrives
  useEffect(() => {
    if (config?.trades && config.trades.length > 0 && !historyLoadedRef.current) {
      historyLoadedRef.current = true;
      const historyLogs = generateHistoryLogs(config.trades);
      if (historyLogs.length > 0) {
        setLogs((prev) => [
          ...prev.slice(0, 6), // Keep boot messages
          '[BOOT] Loading recent activity...',
          '',
          ...historyLogs,
          '--- LIVE ---',
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

  const startFeedPolling = useCallback(() => {
    if (intervalRef.current) return;
    if (!config?.agentId || !config?.enabled) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/agent/${config.agentId}/feed`);
        if (!res.ok) return;
        const json = await res.json();
        if (!json.success || !mountedRef.current) return;

        const feed: FeedData = json.data;
        const asset = feed.asset || 'BTC';
        const sign = feed.priceChange >= 0 ? '+' : '';
        pollCountRef.current++;

        // Price update (show every poll)
        addLog(`[PRICE] ${asset} $${feed.price.toFixed(2)} (${sign}${feed.priceChange.toFixed(2)}%)`);

        // Show candle summary every 2nd poll
        if (pollCountRef.current % 2 === 0 && feed.candles.length > 0) {
          const last = feed.candles[feed.candles.length - 1];
          const dir = last.close >= last.open ? '\u25B2' : '\u25BC';
          addLog(`[K-LINE] ${dir} O:${last.open.toFixed(2)} H:${last.high.toFixed(2)} L:${last.low.toFixed(2)} C:${last.close.toFixed(2)} V:${last.volume.toFixed(0)}`);
        }

        // Show AI analysis when new analysis arrives (or every 4th poll if unchanged)
        if (feed.analysis) {
          const isNewAnalysis = feed.analysis.analyzedAt !== lastAnalysisAtRef.current;
          const showAnalysis = isNewAnalysis || pollCountRef.current % 4 === 0;

          if (isNewAnalysis) {
            lastAnalysisAtRef.current = feed.analysis.analyzedAt;
          }

          if (showAnalysis) {
            addLogRaw('');
            addLog('[AI] \u2500\u2500\u2500 Claude Analysis \u2500\u2500\u2500');

            // Show matched headlines (news Claude found via web search)
            if (feed.analysis.matchedHeadlines && feed.analysis.matchedHeadlines.length > 0) {
              addLog('[AI] Web search results:');
              for (const headline of feed.analysis.matchedHeadlines.slice(0, 5)) {
                const truncated = headline.length > 90 ? headline.slice(0, 87) + '...' : headline;
                addLog(`[NEWS] \u25B8 "${truncated}"`);
              }
            } else {
              addLog('[AI] Scanning market news...');
            }

            // Technical analysis
            if (feed.analysis.technicalSummary) {
              addLog(`[TECHNICAL] ${feed.analysis.technicalSummary}`);
            }

            // AI decision
            const dirLabel = feed.analysis.direction.toUpperCase();
            const tradeLabel = feed.analysis.shouldTrade ? `SIGNAL: ${dirLabel}` : 'HOLD';
            addLog(`[DECISION] ${tradeLabel} | Confidence: ${feed.analysis.confidence}%`);

            // Reasoning
            if (feed.analysis.reason) {
              addLog(`[REASON] ${feed.analysis.reason}`);
            }

            addLog('[AI] \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
            addLogRaw('');
          }
        }

        // Heartbeat every 3rd poll
        if (pollCountRef.current % 3 === 0) {
          addLog(`[HEARTBEAT] Status: ${feed.agent.status} | Fuel: ${feed.agent.energy.toFixed(0)} PVP | Capital: $${feed.agent.capital.toFixed(0)}`);
        }
      } catch {
        // Silent fail — will retry on next interval
      }
    };

    // Poll immediately, then every 15 seconds
    poll();
    intervalRef.current = setInterval(poll, 15_000);
  }, [config?.agentId, config?.enabled, addLog, addLogRaw]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (config?.enabled && config?.agentId) {
      startFeedPolling();
    }
    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [config?.enabled, config?.agentId, startFeedPolling, stopPolling]);

  return { logs, addLog, stopPolling };
}
