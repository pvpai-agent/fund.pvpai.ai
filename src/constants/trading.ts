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

export type DataSourceId = 'hl_kline' | 'ai_web_search' | 'twitter' | 'pvpai_alpha' | 'sec_macro' | 'orbit_space';

export interface DataSourcePresale {
  enabled: boolean;
  /** One-time presale price in USDC */
  price_usdc: number;
  /** Months of service included in presale */
  months_included: number;
  /** Expected launch date (YYYY-MM) */
  launch_date: string;
}

export interface DataSourceConfig {
  id: DataSourceId;
  name: string;
  description: string;
  icon: string;
  /** Actual cost in USDC per day (0 = free / promotional) */
  cost_per_day: number;
  /** Original price before discount (shown as strikethrough when on promo) */
  original_cost_per_day: number;
  /** Whether included by default (free sources) */
  included: boolean;
  /** Presale configuration — when set, the source is not yet live and sold as pre-purchase */
  presale?: DataSourcePresale;
}

export const DATA_SOURCES: DataSourceConfig[] = [
  {
    id: 'hl_kline',
    name: 'K-Line & Free RSS',
    description: 'Real-time candlestick data from Hyperliquid DEX + free RSS news feeds',
    icon: '📊',
    cost_per_day: 0,
    original_cost_per_day: 5,
    included: true,
  },
  {
    id: 'ai_web_search',
    name: 'AI Web Search',
    description: 'Built-in LLM web search — Claude autonomously searches the internet for real-time news, events, and market data',
    icon: '🌐',
    cost_per_day: 0,
    original_cost_per_day: 3,
    included: true,
  },
  {
    id: 'sec_macro',
    name: 'SEC Filings & Macro Data',
    description: 'SEC earnings reports, Fed decisions, CPI/NFP data, and macro economic indicators',
    icon: '📋',
    cost_per_day: 3,
    original_cost_per_day: 8,
    included: false,
  },
  {
    id: 'twitter',
    name: 'Crypto Twitter Sentiment',
    description: 'AI scans X/Twitter for real-time crypto KOL sentiment and social signals',
    icon: '🐦',
    cost_per_day: 2,
    original_cost_per_day: 5,
    included: false,
  },
  {
    id: 'pvpai_alpha',
    name: 'PVPAI Exclusive Alpha Matrix',
    description: 'Aggregated institutional order flows, dark pool data, and proprietary sentiment analysis from the PVPAI hedge fund team',
    icon: '🔮',
    cost_per_day: 10,
    original_cost_per_day: 25,
    included: false,
  },
  {
    id: 'orbit_space',
    name: 'Orbit AI Space Cloud Node',
    description: 'Decentralized & censorship-resistant. Your Agent lives on a LEO satellite. Unbannable, untraceable, granting true digital sovereignty',
    icon: '🛰️',
    cost_per_day: 20,
    original_cost_per_day: 50,
    included: false,
    presale: {
      enabled: true,
      price_usdc: 88,
      months_included: 1,
      launch_date: '2027-01',
    },
  },
];
