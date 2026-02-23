export const TRADING = {
  DEFAULT_SYMBOL: 'BTC',
  MAX_LEVERAGE: 10,
  MIN_TRADE_SIZE_USD: 10,
  MAX_TRADE_SIZE_USD: 100000,
  PERFORMANCE_FEE_PCT: 20,
  REFERRAL_FEE_PCT: 10,
  DEFAULT_STOP_LOSS_PCT: 5,
  DEFAULT_TAKE_PROFIT_PCT: 15,
  DEFAULT_MAX_POSITION_PCT: 100,
  DEFAULT_MAX_DAILY_TRADES: 5,
  MONITOR_INTERVAL_MS: 60000,
} as const;

export const METABOLISM = {
  /** Percentage of mint payment allocated to trading capital */
  CAPITAL_SPLIT_PCT: 80,
  /** Percentage of mint payment allocated to fuel */
  ENERGY_SPLIT_PCT: 20,
  /** Internal conversion rate: PVP units per 1 USD */
  PVP_PER_USD: 100,
  /** Percentage of net profit auto-converted to fuel (vampire feed) */
  VAMPIRE_FEED_PCT: 10,
  /** Minimum USDC to mint a new agent */
  MIN_MINT_USD: 50,
  /** Maximum USDC to mint a new agent */
  MAX_MINT_USD: 10000,
  /** Minimum USDC for recharge */
  MIN_RECHARGE_USD: 10,
  /** Fuel bonus for referral (in PVP units = $0.50) */
  REFERRAL_BLOOD_PACK: 50,
  /** Default agent tier */
  DEFAULT_TIER: 'sniper' as const,
  /** Minimum fuel to keep agent alive (absolute floor, in PVP units) */
  MIN_ENERGY_TO_LIVE: 1,
} as const;

/* ─── Agent Tier System ─── */

export type AgentTier = 'scout' | 'sniper' | 'predator';

export interface TierConfig {
  id: AgentTier;
  name: string;
  tagline: string;
  icon: string;
  theme: 'green' | 'blue' | 'red';
  ai_model: string;
  ai_label: string;
  compute: string;
  data_feeds: string[];
  frequency: number;
  frequency_label: string;
  pvp_per_day: number;
  burn_per_hour: number;
}

export const AGENT_TIERS: Record<AgentTier, TierConfig> = {
  scout: {
    id: 'scout',
    name: 'THE SCOUT',
    tagline: 'Patient & Low-Frequency. Perfect for price-action swing trading.',
    icon: '🔭',
    theme: 'green',
    ai_model: 'claude-haiku-4-5-20251001',
    ai_label: 'Claude 3 Haiku',
    compute: 'Shared Node',
    data_feeds: ['HL K-Line (1h)'],
    frequency: 6,
    frequency_label: '6 checks/hr',
    pvp_per_day: 100,
    burn_per_hour: 100 / 24,
  },
  sniper: {
    id: 'sniper',
    name: 'THE SNIPER',
    tagline: 'Event-driven assassin. Reacts to news catalysts in real-time.',
    icon: '🎯',
    theme: 'blue',
    ai_model: 'claude-sonnet-4-20250514',
    ai_label: 'Claude 3.5 Sonnet',
    compute: 'Dedicated VPS',
    data_feeds: ['HL K-Line (1h)'],
    frequency: 12,
    frequency_label: '12 checks/hr',
    pvp_per_day: 500,
    burn_per_hour: 500 / 24,
  },
  predator: {
    id: 'predator',
    name: 'THE PREDATOR',
    tagline: 'High-frequency alpha hunter. Millisecond execution.',
    icon: '👹',
    theme: 'red',
    ai_model: 'claude-opus-4-20250514',
    ai_label: 'GPT-4o',
    compute: 'Colocation',
    data_feeds: ['HL K-Line (5m/1h)'],
    frequency: 30,
    frequency_label: '30 checks/hr',
    pvp_per_day: 2000,
    burn_per_hour: 2000 / 24,
  },
};

/* ─── Data Source Add-ons ─── */

export type DataSourceId = 'hl_kline' | 'hot_news' | 'twitter' | 'pvpai_alpha';

export interface DataSourceConfig {
  id: DataSourceId;
  name: string;
  description: string;
  icon: string;
  /** Cost in USDC per day (0 = free) */
  cost_per_day: number;
  /** Whether included by default (free sources) */
  included: boolean;
}

export const DATA_SOURCES: DataSourceConfig[] = [
  {
    id: 'hl_kline',
    name: 'Hyperliquid K-Line',
    description: 'Real-time candlestick data from Hyperliquid DEX',
    icon: '📊',
    cost_per_day: 0,
    included: true,
  },
  {
    id: 'hot_news',
    name: 'Trending News',
    description: 'AI autonomously searches the web for the latest market news about your asset',
    icon: '📰',
    cost_per_day: 0,
    included: true,
  },
  {
    id: 'twitter',
    name: 'X / Twitter Feed',
    description: 'AI searches X/Twitter for real-time social signals and KOL sentiment',
    icon: '🐦',
    cost_per_day: 10,
    included: false,
  },
  {
    id: 'pvpai_alpha',
    name: 'PVP AI Alpha',
    description: 'Deep AI research: whale tracking, institutional flows, multi-source cross-validation',
    icon: '🔮',
    cost_per_day: 30,
    included: false,
  },
];
