export type AgentStatus = 'draft' | 'active' | 'paused' | 'closed' | 'dead';
export type TxType = 'subscription' | 'deposit' | 'withdrawal' | 'trade_pnl' | 'performance_fee' | 'referral_fee' | 'fund_allocation' | 'fund_deallocation' | 'energy_purchase' | 'energy_burn' | 'energy_vampire' | 'energy_referral' | 'capital_return' | 'agent_mint' | 'investment' | 'investment_withdrawal' | 'loot_fee' | 'upgrade_fee' | 'creator_fee' | 'creator_claim' | 'clone_fuel_referral' | 'capital_withdrawal';
export type TxStatus = 'pending' | 'confirmed' | 'failed';
export type TradeDirection = 'long' | 'short';
export type TradeStatus = 'open' | 'closed' | 'cancelled';
export type EnergyReason = 'heartbeat' | 'trade_open' | 'trade_close' | 'api_call' | 'vampire_feed' | 'blood_pack' | 'manual_topup' | 'death_drain';

export interface User {
  id: string;
  wallet_address: string;
  display_name: string | null;
  referral_code: string;
  referred_by: string | null;
  balance_usdt: number;
  pvpai_points: number;
  created_at: string;
  updated_at: string;
}

export interface Agent {
  id: string;
  user_id: string;
  prompt: string;
  parsed_rules: ParsedRules;
  name: string;
  avatar_seed: string;
  avatar_url: string | null;
  ai_wallet: string;
  status: AgentStatus;
  allocated_funds: number;
  energy_balance: number;
  capital_balance: number;
  burn_rate_per_hour: number;
  died_at: string | null;
  clone_parent_id: string | null;
  creator_earnings: number;
  total_trades: number;
  total_pnl: number;
  win_rate: number;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  agent_id: string | null;
  type: TxType;
  status: TxStatus;
  amount: number;
  token: string;
  chain: string | null;
  tx_hash: string | null;
  description: string | null;
  balance_before: number | null;
  balance_after: number | null;
  created_at: string;
}

export interface Trade {
  id: string;
  agent_id: string;
  user_id: string;
  symbol: string;
  direction: TradeDirection;
  size: number;
  leverage: number;
  entry_price: number | null;
  exit_price: number | null;
  realized_pnl: number | null;
  fee_amount: number | null;
  referrer_fee: number | null;
  hl_order_id: string | null;
  trigger_reason: string | null;
  trigger_data: Record<string, unknown> | null;
  status: TradeStatus;
  opened_at: string;
  closed_at: string | null;
}

export interface ReferralEarning {
  id: string;
  referrer_id: string;
  referred_id: string;
  trade_id: string | null;
  amount: number;
  energy_amount: number | null;
  target_agent_id: string | null;
  created_at: string;
}

export interface EnergyLog {
  id: string;
  agent_id: string;
  amount: number;
  reason: EnergyReason;
  description: string | null;
  energy_before: number;
  energy_after: number;
  created_at: string;
}

export type InvestmentStatus = 'active' | 'withdrawn';

export interface Investment {
  id: string;
  user_id: string;
  agent_id: string;
  amount: number;
  share_pct: number;
  status: InvestmentStatus;
  created_at: string;
  withdrawn_at: string | null;
}

export interface ParsedRules {
  name: string;
  description: string;
  assets: string[];
  direction_bias: 'long' | 'short' | 'both';
  triggers: Array<{
    type: 'keyword' | 'price_level' | 'time_based' | 'momentum';
    condition: string;
    parameters: Record<string, unknown>;
  }>;
  risk_management: {
    max_position_size_pct: number;
    stop_loss_pct: number;
    take_profit_pct: number;
    max_leverage: number;
    max_daily_trades: number;
  };
  keywords: string[];
  /** Agent tier (scout / sniper / predator) */
  tier?: 'scout' | 'sniper' | 'predator';
  /** Selected data source IDs */
  data_sources?: string[];
  /** Revenue split configuration (percentages, must sum to 100) */
  revenue_split?: {
    /** % of profits returned to liquidity pool (LP investors) */
    lp_pct: number;
    /** % of profits sent to agent treasury (agent's own wallet) */
    agent_pct: number;
    /** % of profits sent to agent creator */
    creator_pct: number;
  };
}

/**
 * Known asset symbol → aliases for inference.
 * When parsed_rules.assets is the default ['BTC'] but description/keywords
 * clearly mention a different asset, we override with the detected asset.
 */
const ASSET_ALIASES: Record<string, string[]> = {
  'xyz:NVDA': ['NVDA', 'Nvidia', 'Jensen Huang', 'GeForce', 'H100', 'B200'],
  'xyz:TSLA': ['TSLA', 'Tesla', 'Elon Musk'],
  'xyz:AAPL': ['AAPL', 'Apple', 'iPhone', 'Tim Cook'],
  'xyz:MSFT': ['MSFT', 'Microsoft', 'Copilot', 'Azure'],
  'xyz:AMZN': ['AMZN', 'Amazon', 'AWS'],
  'xyz:GOOGL': ['GOOGL', 'GOOG', 'Google', 'Alphabet', 'Gemini'],
  'xyz:META': ['META', 'Meta', 'Facebook', 'Zuckerberg', 'Instagram'],
  'xyz:HOOD': ['HOOD', 'Robinhood'],
  'xyz:MSTR': ['MSTR', 'MicroStrategy', 'Saylor'],
  'xyz:ORCL': ['ORCL', 'Oracle'],
  'xyz:AVGO': ['AVGO', 'Broadcom'],
  'xyz:MU': ['MU ', 'Micron'],  // space after MU to avoid false matches
  'xyz:SPACEX': ['SPACEX', 'SpaceX'],
  'xyz:OPENAI': ['OPENAI', 'OpenAI'],
  'xyz:SPY': ['SPY', 'S&P 500', 'S&P500'],
  'xyz:QQQ': ['QQQ', 'Nasdaq 100', 'Nasdaq100'],
  'xyz:GLD': ['GLD ', 'gold'],  // space to avoid "Goldman" matches
  'xyz:SLV': ['SLV', 'silver'],
  'ETH': ['ETH', 'Ethereum', 'Ether'],
  'SOL': ['SOL', 'Solana'],
  'XRP': ['XRP', 'Ripple'],
  'xyz:PEUR': ['PEUR', 'EUR/USD', 'Euro'],
};

function inferAssetsFromContext(rules: ParsedRules): string[] | null {
  const text = [
    rules.name ?? '',
    rules.description ?? '',
    ...(rules.keywords ?? []),
  ].join(' ');

  if (!text.trim()) return null;

  const detected: string[] = [];
  for (const [symbol, aliases] of Object.entries(ASSET_ALIASES)) {
    for (const alias of aliases) {
      if (text.toLowerCase().includes(alias.toLowerCase().trim())) {
        detected.push(symbol);
        break;
      }
    }
  }

  // Only override if we found non-BTC assets (the default)
  if (detected.length > 0 && !(detected.length === 1 && detected[0] === 'BTC')) {
    return detected;
  }
  return null;
}

/** Get assets array from parsed rules (handles backward compat with legacy single-asset field) */
export function getAgentAssets(rules: ParsedRules | null | undefined): string[] {
  if (!rules) return ['BTC'];

  // If assets are set and NOT just the default ['BTC'], use them directly
  if (rules.assets && rules.assets.length > 0) {
    const isDefault = rules.assets.length === 1 && rules.assets[0] === 'BTC';
    if (!isDefault) return rules.assets;

    // Assets is ['BTC'] — check if description/keywords suggest a different asset
    const inferred = inferAssetsFromContext(rules);
    if (inferred) return inferred;
    return rules.assets;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const legacy = (rules as any).asset;
  if (legacy && typeof legacy === 'string') return [legacy];
  return ['BTC'];
}
