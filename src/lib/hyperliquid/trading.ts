import { getHyperliquidClient } from './client';

const HL_API = 'https://api.hyperliquid.xyz/info';

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

let candleCache: { data: CandleData[]; fetchedAt: number; key: string } | null = null;
const CANDLE_CACHE_TTL = 60_000; // 1 minute

export async function getCandleData(
  symbol: string,
  interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' = '1h',
  limit = 24
): Promise<CandleData[]> {
  const cacheKey = `${symbol}:${interval}:${limit}`;
  if (candleCache && candleCache.key === cacheKey && Date.now() - candleCache.fetchedAt < CANDLE_CACHE_TTL) {
    return candleCache.data;
  }

  try {
    const now = Date.now();
    // HL expects startTime in ms; fetch enough history for the requested limit
    const intervalMs: Record<string, number> = {
      '1m': 60_000, '5m': 300_000, '15m': 900_000,
      '1h': 3_600_000, '4h': 14_400_000, '1d': 86_400_000,
    };
    const startTime = now - intervalMs[interval] * (limit + 2);

    const { dex } = parseDex(symbol);
    const payload: Record<string, unknown> = {
      type: 'candleSnapshot',
      req: { coin: symbol, interval, startTime, endTime: now },
    };
    if (dex) payload.dex = dex;

    const res = await fetch(HL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const raw = await res.json();
    const candles: CandleData[] = (Array.isArray(raw) ? raw : [])
      .slice(-limit)
      .map((c: Record<string, unknown>) => ({
        time: Number(c.t ?? c.T ?? 0),
        open: Number(c.o ?? 0),
        high: Number(c.h ?? 0),
        low: Number(c.l ?? 0),
        close: Number(c.c ?? 0),
        volume: Number(c.v ?? 0),
      }));

    candleCache = { data: candles, fetchedAt: Date.now(), key: cacheKey };
    return candles;
  } catch (err) {
    console.error('[HL] Failed to get candle data:', err);
    return [];
  }
}

export interface OrderParams {
  symbol: string;
  isBuy: boolean;
  size: number;
  price?: number;
  leverage?: number;
  reduceOnly?: boolean;
}

export interface OrderResult {
  orderId: string;
  status: string;
  filledSize: number;
  avgPrice: number;
}

export interface Position {
  symbol: string;
  size: number;
  entryPrice: number;
  unrealizedPnl: number;
  leverage: number;
  side: 'long' | 'short';
}

export interface Fill {
  coin: string;
  side: string;
  px: number;
  sz: number;
  time: number;
  oid: string;
  closedPnl: number;
}

/** Parse dex prefix from symbol, e.g. "xyz:NVDA" → { dex: "xyz", coin: "xyz:NVDA" } */
function parseDex(symbol: string): { dex: string; coin: string } {
  const idx = symbol.indexOf(':');
  if (idx > 0) {
    return { dex: symbol.slice(0, idx), coin: symbol };
  }
  return { dex: '', coin: symbol };
}

/** Cache szDecimals per symbol to avoid repeated meta lookups */
const szDecimalsCache = new Map<string, number>();

async function getSzDecimals(symbol: string): Promise<number> {
  if (szDecimalsCache.has(symbol)) return szDecimalsCache.get(symbol)!;

  const { dex } = parseDex(symbol);

  if (dex) {
    // Community dex — use raw API with dex param
    const res = await fetch(HL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'meta', dex }),
    });
    const meta = await res.json();
    const asset = (meta.universe as Array<{ name: string; szDecimals: number }>)
      .find((a) => a.name === symbol);
    const decimals = asset?.szDecimals ?? 3;
    szDecimalsCache.set(symbol, decimals);
    return decimals;
  }

  // Standard perp — use SDK
  const hl = await getHyperliquidClient();
  const meta = await hl.info.perpetuals.getMeta();
  const asset = (meta.universe as Array<{ name: string; szDecimals: number }>)
    .find((a) => a.name === symbol);
  const decimals = asset?.szDecimals ?? 4;
  szDecimalsCache.set(symbol, decimals);
  return decimals;
}

function truncateToDecimals(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.floor(value * factor) / factor;
}

export async function placeMarketOrder(params: OrderParams): Promise<OrderResult> {
  const hl = await getHyperliquidClient();
  const { dex } = parseDex(params.symbol);

  // xyz dex uses strict isolated margin only
  if (params.leverage && params.leverage > 1) {
    const marginMode = dex ? 'isolated' : 'cross';
    await hl.exchange.updateLeverage(params.symbol, marginMode, params.leverage);
  }

  // Truncate size to the correct decimal precision for this asset
  const decimals = await getSzDecimals(params.symbol);
  const sz = truncateToDecimals(params.size, decimals);

  if (sz <= 0) {
    throw new Error(`Order size too small after rounding: ${params.size} → ${sz} (${decimals} decimals)`);
  }

  // IOC orders still require a valid limit price as slippage protection.
  // If no explicit price is given, use the current mark price ± 5%.
  let limitPx = params.price;
  if (!limitPx) {
    const markPx = await getMarkPrice(params.symbol);
    limitPx = params.isBuy
      ? Math.round(markPx * 1.05 * 100) / 100   // Buy: up to 5% above mark
      : Math.round(markPx * 0.95 * 100) / 100;  // Sell: down to 5% below mark
  }

  const result = await hl.exchange.placeOrder({
    coin: params.symbol,
    is_buy: params.isBuy,
    sz,
    limit_px: limitPx,
    order_type: { limit: { tif: 'Ioc' } },
    reduce_only: params.reduceOnly ?? false,
  });

  // The SDK returns a nested structure:
  // { status: "ok", response: { type: "order", data: { statuses: [{ filled: { totalSz, avgPx, oid } }] } } }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = result as any;
  const statuses = raw?.response?.data?.statuses ?? raw?.data?.statuses ?? [];
  const first = statuses[0] ?? {};
  const filled = first.filled ?? first.resting ?? {};

  return {
    orderId: String(filled.oid ?? raw?.oid ?? ''),
    status: filled.totalSz ? 'filled' : first.error ? 'error' : 'unknown',
    filledSize: Number(filled.totalSz ?? 0),
    avgPrice: Number(filled.avgPx ?? 0),
  };
}

/** Close an existing position by placing a reduce-only market order */
export async function closePosition(
  symbol: string,
  size: number,
  isCurrentlyLong: boolean
): Promise<OrderResult> {
  return placeMarketOrder({
    symbol,
    isBuy: !isCurrentlyLong,
    size,
    reduceOnly: true,
  });
}

export async function getPositions(dex?: string): Promise<Position[]> {
  const wallet = process.env.HYPERLIQUID_WALLET_ADDRESS!;

  if (dex) {
    // Community dex — use raw API
    const res = await fetch(HL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'clearinghouseState', user: wallet, dex }),
    });
    const data = await res.json();
    return parsePositions(data);
  }

  const hl = await getHyperliquidClient();
  const data = await hl.info.perpetuals.getClearinghouseState(wallet);
  return parsePositions(data as unknown as Record<string, unknown>);
}

function parsePositions(data: Record<string, unknown>): Position[] {
  const positions = (data.assetPositions ?? []) as Array<Record<string, unknown>>;
  return positions
    .filter((p) => {
      const pos = p.position as Record<string, unknown> | undefined;
      return pos && Number(pos.szi) !== 0;
    })
    .map((p) => {
      const pos = p.position as Record<string, unknown>;
      const size = Number(pos.szi);
      return {
        symbol: String(pos.coin),
        size: Math.abs(size),
        entryPrice: Number(pos.entryPx),
        unrealizedPnl: Number(pos.unrealizedPnl),
        leverage: Number(pos.leverage ?? 1),
        side: (size > 0 ? 'long' : 'short') as 'long' | 'short',
      };
    });
}

export async function getMarkPrice(symbol: string): Promise<number> {
  const { dex } = parseDex(symbol);

  if (dex) {
    // Community dex — use raw API with dex param
    const res = await fetch(HL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'metaAndAssetCtxs', dex }),
    });
    const data = await res.json();
    const meta = data[0];
    const ctxs = data[1] as Array<{ markPx: string }>;
    const idx = (meta.universe as Array<{ name: string }>).findIndex((a) => a.name === symbol);
    if (idx >= 0 && ctxs[idx]) {
      return Number(ctxs[idx].markPx);
    }
    throw new Error(`No price found for ${symbol}`);
  }

  // Standard perp — use SDK
  const hl = await getHyperliquidClient();
  const mids = await hl.info.getAllMids();
  const price = (mids as Record<string, string>)[symbol];
  if (!price) throw new Error(`No price found for ${symbol}`);
  return Number(price);
}

/** Get recent fills (trade executions) for the account */
export async function getUserFills(limit = 50): Promise<Fill[]> {
  const hl = await getHyperliquidClient();
  const wallet = process.env.HYPERLIQUID_WALLET_ADDRESS!;

  try {
    const fills = await hl.info.getUserFills(wallet);
    const rawFills = (fills ?? []) as Array<Record<string, unknown>>;

    return rawFills.slice(0, limit).map((f) => ({
      coin: String(f.coin ?? ''),
      side: String(f.side ?? ''),
      px: Number(f.px ?? 0),
      sz: Number(f.sz ?? 0),
      time: Number(f.time ?? 0),
      oid: String(f.oid ?? ''),
      closedPnl: Number(f.closedPnl ?? 0),
    }));
  } catch (err) {
    console.error('[HL] Failed to get fills:', err);
    return [];
  }
}
