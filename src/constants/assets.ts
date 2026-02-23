/**
 * Tradeable assets on PVP AI platform.
 * Sources: Hyperliquid TradeFi (HIP-3 / Wagyu.xyz) + top crypto perps.
 * One trading pair per underlying asset, deduplicated by highest volume.
 */

export interface TradeableAsset {
  /** Symbol used on Hyperliquid (e.g. 'xyz:NVDA', 'BTC') */
  symbol: string;
  /** Display name */
  name: string;
  /** Short ticker for UI */
  ticker: string;
  /** Asset category */
  category: 'stock' | 'etf' | 'crypto' | 'forex' | 'commodity';
  /** Icon / emoji */
  icon: string;
}

/* ─── US Stocks (Hyperliquid TradeFi via HIP-3) ─── */
const STOCKS: TradeableAsset[] = [
  { symbol: 'xyz:NVDA', name: 'NVIDIA', ticker: 'NVDA', category: 'stock', icon: '🟢' },
  { symbol: 'xyz:TSLA', name: 'Tesla', ticker: 'TSLA', category: 'stock', icon: '🚗' },
  { symbol: 'xyz:AAPL', name: 'Apple', ticker: 'AAPL', category: 'stock', icon: '🍎' },
  { symbol: 'xyz:MSFT', name: 'Microsoft', ticker: 'MSFT', category: 'stock', icon: '🪟' },
  { symbol: 'xyz:AMZN', name: 'Amazon', ticker: 'AMZN', category: 'stock', icon: '📦' },
  { symbol: 'xyz:GOOGL', name: 'Alphabet', ticker: 'GOOGL', category: 'stock', icon: '🔍' },
  { symbol: 'xyz:META', name: 'Meta Platforms', ticker: 'META', category: 'stock', icon: '👁' },
  { symbol: 'xyz:HOOD', name: 'Robinhood', ticker: 'HOOD', category: 'stock', icon: '🏹' },
  { symbol: 'xyz:MSTR', name: 'MicroStrategy', ticker: 'MSTR', category: 'stock', icon: '₿' },
  { symbol: 'xyz:ORCL', name: 'Oracle', ticker: 'ORCL', category: 'stock', icon: '☁' },
  { symbol: 'xyz:AVGO', name: 'Broadcom', ticker: 'AVGO', category: 'stock', icon: '📡' },
  { symbol: 'xyz:MU', name: 'Micron', ticker: 'MU', category: 'stock', icon: '💾' },
  { symbol: 'xyz:CRCL', name: 'Circle', ticker: 'CRCL', category: 'stock', icon: '🔵' },
  { symbol: 'xyz:SPACEX', name: 'SpaceX', ticker: 'SPACEX', category: 'stock', icon: '🚀' },
  { symbol: 'xyz:OPENAI', name: 'OpenAI', ticker: 'OPENAI', category: 'stock', icon: '🤖' },
];

/* ─── ETFs / Indices ─── */
const ETFS: TradeableAsset[] = [
  { symbol: 'xyz:SPY', name: 'S&P 500 ETF', ticker: 'SPY', category: 'etf', icon: '📊' },
  { symbol: 'xyz:QQQ', name: 'Nasdaq 100 ETF', ticker: 'QQQ', category: 'etf', icon: '📈' },
  { symbol: 'xyz:GLD', name: 'Gold ETF', ticker: 'GLD', category: 'etf', icon: '🥇' },
  { symbol: 'xyz:SLV', name: 'Silver ETF', ticker: 'SLV', category: 'etf', icon: '🥈' },
];

/* ─── Major Crypto Perps ─── */
const CRYPTO: TradeableAsset[] = [
  { symbol: 'BTC', name: 'Bitcoin', ticker: 'BTC', category: 'crypto', icon: '₿' },
  { symbol: 'ETH', name: 'Ethereum', ticker: 'ETH', category: 'crypto', icon: '⟠' },
  { symbol: 'SOL', name: 'Solana', ticker: 'SOL', category: 'crypto', icon: '◎' },
  { symbol: 'XRP', name: 'XRP', ticker: 'XRP', category: 'crypto', icon: '✕' },
];

/* ─── Forex ─── */
const FOREX: TradeableAsset[] = [
  { symbol: 'xyz:PEUR', name: 'EUR/USD', ticker: 'EUR', category: 'forex', icon: '€' },
];

/* ─── All tradeable assets ─── */
export const TRADEABLE_ASSETS: TradeableAsset[] = [
  ...CRYPTO,
  ...STOCKS,
  ...ETFS,
  ...FOREX,
];

/** Quick lookup by symbol */
export const ASSET_MAP = new Map(TRADEABLE_ASSETS.map((a) => [a.symbol, a]));

/** Get display name from symbol (e.g. 'xyz:NVDA' -> 'NVDA') */
export function getAssetTicker(symbol: string): string {
  return ASSET_MAP.get(symbol)?.ticker ?? symbol.replace('xyz:', '');
}

/** All category labels */
export const ASSET_CATEGORIES = [
  { key: 'crypto', label: 'Crypto' },
  { key: 'stock', label: 'US Stocks' },
  { key: 'etf', label: 'ETFs' },
  { key: 'forex', label: 'Forex' },
] as const;
