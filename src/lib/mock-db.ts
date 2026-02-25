/**
 * In-memory mock database for development without Supabase.
 * Data persists as long as the Next.js dev server is running.
 */
import { randomUUID } from 'crypto';
import type { User, Agent, Transaction, EnergyLog, Investment } from '@/types/database';
import type { LobbyEvent, LobbyEventType } from '@/types/events';
import type { ChatMessage, ChatRole, OverrideStatus } from '@/types/chat';
import type { ParsedRules } from '@/types/database';

function uuid(): string {
  return randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

/* ─── HMR-safe globalThis storage ─── */

interface MockStore {
  users: Map<string, User>;
  agents: Map<string, Agent>;
  transactions: Map<string, Transaction>;
  energyLogs: EnergyLog[];
  usersByWallet: Map<string, string>;
  txByHash: Map<string, string>;
  analysisLogs: AnalysisLogEntry[];
  // Phase 1-5 additions
  lobbyEvents: LobbyEvent[];
  investments: Map<string, Investment>;
  chatMessages: Map<string, ChatMessage[]>; // agentId → messages
  lootRecords: Map<string, Set<string>>; // agentId → Set<userId>
  strategyVersions: Map<string, StrategyVersion[]>; // agentId → versions
  referralClicks: Map<string, ReferralClick[]>; // referralCode → clicks
  seeded: boolean;
}

const g = globalThis as unknown as { __mockStore?: MockStore };
if (!g.__mockStore) {
  g.__mockStore = {
    users: new Map(),
    agents: new Map(),
    transactions: new Map(),
    energyLogs: [],
    usersByWallet: new Map(),
    txByHash: new Map(),
    analysisLogs: [],
    lobbyEvents: [],
    investments: new Map(),
    chatMessages: new Map(),
    lootRecords: new Map(),
    strategyVersions: new Map(),
    referralClicks: new Map(),
    seeded: false,
  };
}

const store = g.__mockStore;

/* ─── Storage aliases ─── */
const users = store.users;
const agents = store.agents;
const transactions = store.transactions;
const energyLogs = store.energyLogs;

/* Indexes */
const usersByWallet = store.usersByWallet;
const txByHash = store.txByHash;

/* ─── Users ─── */

export function mockFindOrCreateUser(walletAddress: string): { user: User; isNew: boolean } {
  const addr = walletAddress.toLowerCase();
  const existingId = usersByWallet.get(addr);
  if (existingId) {
    return { user: users.get(existingId)!, isNew: false };
  }

  const user: User = {
    id: uuid(),
    wallet_address: addr,
    display_name: null,
    referral_code: Math.random().toString(36).slice(2, 8).toUpperCase(),
    referred_by: null,
    balance_usdt: 1000,
    pvpai_points: 288,
    created_at: now(),
    updated_at: now(),
  };
  users.set(user.id, user);
  usersByWallet.set(addr, user.id);

  return { user, isNew: true };
}

export function mockGetUserByWallet(walletAddress: string): User | null {
  const id = usersByWallet.get(walletAddress.toLowerCase());
  return id ? users.get(id) ?? null : null;
}

export function mockGetUserById(userId: string): User | null {
  return users.get(userId) ?? null;
}

export function mockUpdateUserBalance(userId: string, delta: number): User {
  const user = users.get(userId);
  if (!user) throw new Error('User not found');
  user.balance_usdt = Number(user.balance_usdt) + delta;
  user.updated_at = now();
  return { ...user };
}

/* ─── Agents ─── */

export function mockCreateAgent(input: {
  userId: string;
  name: string;
  prompt: string;
  parsedRules: Agent['parsed_rules'];
  avatarSeed: string;
  avatarUrl?: string;
  allocatedFunds: number;
  energyBalance: number;
  capitalBalance: number;
  burnRatePerHour: number;
}): Agent {
  // Generate a unique wallet address for this agent
  const walletId = uuid().replace(/-/g, '');
  const aiWallet = '0x' + walletId.slice(0, 40);

  const agent: Agent = {
    id: uuid(),
    user_id: input.userId,
    name: input.name,
    prompt: input.prompt,
    parsed_rules: input.parsedRules,
    avatar_seed: input.avatarSeed,
    avatar_url: input.avatarUrl ?? null,
    ai_wallet: aiWallet,
    status: 'active',
    allocated_funds: input.allocatedFunds,
    energy_balance: input.energyBalance,
    capital_balance: input.capitalBalance,
    burn_rate_per_hour: input.burnRatePerHour,
    died_at: null,
    clone_parent_id: null,
    creator_earnings: 0,
    total_trades: 0,
    total_pnl: 0,
    win_rate: 0,
    created_at: now(),
    updated_at: now(),
  };
  agents.set(agent.id, agent);
  return { ...agent };
}

export function mockGetUserAgents(userId: string): Agent[] {
  return [...agents.values()]
    .filter((a) => a.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function mockGetAgentById(agentId: string): Agent | null {
  return agents.get(agentId) ? { ...agents.get(agentId)! } : null;
}

export function mockUpdateAgentStatus(agentId: string, status: Agent['status']): Agent {
  const agent = agents.get(agentId);
  if (!agent) throw new Error('Agent not found');
  agent.status = status;
  agent.updated_at = now();
  return { ...agent };
}

export function mockGetActiveAgents(): Agent[] {
  return [...agents.values()].filter((a) => a.status === 'active');
}

export function mockGetDeadAgents(userId: string): Agent[] {
  return [...agents.values()]
    .filter((a) => a.user_id === userId && a.status === 'dead')
    .sort((a, b) => (b.died_at ?? '').localeCompare(a.died_at ?? ''));
}

export function mockUpdateAgent(agentId: string, updates: Partial<Agent>): Agent {
  const agent = agents.get(agentId);
  if (!agent) throw new Error('Agent not found');
  Object.assign(agent, updates, { updated_at: now() });
  return { ...agent };
}

/* ─── Transactions ─── */

export function mockRecordTransaction(input: {
  userId: string;
  agentId?: string;
  type: Transaction['type'];
  status?: Transaction['status'];
  amount: number;
  token?: string;
  chain?: string;
  txHash?: string;
  description?: string;
  balanceBefore?: number;
  balanceAfter?: number;
}): Transaction {
  const tx: Transaction = {
    id: uuid(),
    user_id: input.userId,
    agent_id: input.agentId ?? null,
    type: input.type,
    status: input.status ?? 'confirmed',
    amount: input.amount,
    token: input.token ?? 'USDC',
    chain: input.chain ?? null,
    tx_hash: input.txHash ?? null,
    description: input.description ?? null,
    balance_before: input.balanceBefore ?? null,
    balance_after: input.balanceAfter ?? null,
    created_at: now(),
  };
  transactions.set(tx.id, tx);
  if (tx.tx_hash) txByHash.set(tx.tx_hash, tx.id);
  return { ...tx };
}

export function mockGetTransactionByTxHash(txHash: string): Transaction | null {
  const id = txByHash.get(txHash);
  return id ? transactions.get(id) ?? null : null;
}

export function mockGetUserTransactions(userId: string, limit = 20, offset = 0): Transaction[] {
  return [...transactions.values()]
    .filter((t) => t.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(offset, offset + limit);
}

/* ─── Energy Logs ─── */

export function mockLogEnergy(input: {
  agentId: string;
  amount: number;
  reason: EnergyLog['reason'];
  description?: string;
}): { agent: Agent; log: EnergyLog } {
  const agent = agents.get(input.agentId);
  if (!agent) throw new Error('Agent not found');

  const energyBefore = Number(agent.energy_balance);
  const energyAfter = Math.max(0, energyBefore + input.amount);
  agent.energy_balance = energyAfter;
  agent.updated_at = now();

  const log: EnergyLog = {
    id: uuid(),
    agent_id: input.agentId,
    amount: input.amount,
    reason: input.reason,
    description: input.description ?? null,
    energy_before: energyBefore,
    energy_after: energyAfter,
    created_at: now(),
  };
  energyLogs.push(log);

  return { agent: { ...agent }, log };
}

export function mockGetEnergyLogs(agentId: string, limit = 50): EnergyLog[] {
  return energyLogs
    .filter((l) => l.agent_id === agentId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

/* ─── Analysis Activity Logs ─── */

export interface AnalysisLogEntry {
  id: string;
  agent_id: string;
  agent_name: string;
  price: number;
  news_count: number;
  candle_count: number;
  confidence: number;
  direction: 'long' | 'short';
  reason: string;
  technical_summary: string;
  matched_headlines: string[];
  should_trade: boolean;
  created_at: string;
}

const analysisLogs = store.analysisLogs;

export function mockAddAnalysisLog(entry: Omit<AnalysisLogEntry, 'id' | 'created_at'>): AnalysisLogEntry {
  const log: AnalysisLogEntry = {
    ...entry,
    id: uuid(),
    created_at: now(),
  };
  analysisLogs.push(log);
  // Keep last 500 entries
  if (analysisLogs.length > 500) analysisLogs.splice(0, analysisLogs.length - 500);
  return log;
}

export function mockGetAnalysisLogs(limit = 100): AnalysisLogEntry[] {
  return [...analysisLogs]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

export function mockGetAgentAnalysisLogs(agentId: string, limit = 5): AnalysisLogEntry[] {
  return [...analysisLogs]
    .filter((l) => l.agent_id === agentId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

/* ─── Admin Aggregate Helpers ─── */

export function mockGetAllUsers(): User[] {
  return [...users.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function mockGetAllAgents(): Agent[] {
  return [...agents.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function mockGetAllTransactions(limit = 200, offset = 0): Transaction[] {
  return [...transactions.values()]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(offset, offset + limit);
}

/* ─── Lobby Events ─── */

export function mockAddLobbyEvent(input: {
  type: LobbyEventType;
  agentId: string;
  agentName: string;
  data?: LobbyEvent['data'];
}): LobbyEvent {
  const event: LobbyEvent = {
    id: uuid(),
    type: input.type,
    agent_id: input.agentId,
    agent_name: input.agentName,
    data: input.data ?? {},
    created_at: now(),
  };
  store.lobbyEvents.push(event);
  // Keep last 200
  if (store.lobbyEvents.length > 200) store.lobbyEvents.splice(0, store.lobbyEvents.length - 200);
  return event;
}

export function mockGetLobbyEvents(limit = 50): LobbyEvent[] {
  return [...store.lobbyEvents]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

export function mockGetRecentAgents(limit = 12): Agent[] {
  return [...agents.values()]
    .filter((a) => a.status === 'active')
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

export function mockGetAllAgentsSorted(sortBy: 'roi' | 'tvl' | 'lifespan', limit = 20): Agent[] {
  const all = [...agents.values()].filter((a) => a.status !== 'draft');

  switch (sortBy) {
    case 'roi':
      return all
        .filter((a) => a.capital_balance > 0)
        .sort((a, b) => {
          const roiA = a.allocated_funds > 0 ? (a.total_pnl / a.allocated_funds) * 100 : 0;
          const roiB = b.allocated_funds > 0 ? (b.total_pnl / b.allocated_funds) * 100 : 0;
          return roiB - roiA;
        })
        .slice(0, limit);
    case 'tvl':
      return all
        .sort((a, b) => b.capital_balance - a.capital_balance)
        .slice(0, limit);
    case 'lifespan': {
      const nowMs = Date.now();
      return all
        .sort((a, b) => {
          const endA = a.died_at ? new Date(a.died_at).getTime() : nowMs;
          const endB = b.died_at ? new Date(b.died_at).getTime() : nowMs;
          const lifeA = endA - new Date(a.created_at).getTime();
          const lifeB = endB - new Date(b.created_at).getTime();
          return lifeB - lifeA;
        })
        .slice(0, limit);
    }
    default:
      return all.slice(0, limit);
  }
}

/* ─── Investments ─── */

export function mockCreateInvestment(input: {
  userId: string;
  agentId: string;
  amount: number;
}): Investment {
  const agent = agents.get(input.agentId);
  if (!agent) throw new Error('Agent not found');

  const newPool = agent.capital_balance + input.amount;
  const sharePct = (input.amount / newPool) * 100;

  // Increase agent capital
  agent.capital_balance = newPool;
  agent.updated_at = now();

  const investment: Investment = {
    id: uuid(),
    user_id: input.userId,
    agent_id: input.agentId,
    amount: input.amount,
    share_pct: sharePct,
    status: 'active',
    created_at: now(),
    withdrawn_at: null,
  };
  store.investments.set(investment.id, investment);
  return { ...investment };
}

export function mockGetUserInvestments(userId: string): (Investment & { agent: Agent | null })[] {
  return [...store.investments.values()]
    .filter((inv) => inv.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((inv) => ({
      ...inv,
      agent: agents.get(inv.agent_id) ? { ...agents.get(inv.agent_id)! } : null,
    }));
}

export function mockGetAgentInvestments(agentId: string): Investment[] {
  return [...store.investments.values()]
    .filter((inv) => inv.agent_id === agentId && inv.status === 'active')
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function mockWithdrawInvestment(investmentId: string): { investment: Investment; netAmount: number; feeAmount: number } {
  const inv = store.investments.get(investmentId);
  if (!inv) throw new Error('Investment not found');
  if (inv.status !== 'active') throw new Error('Investment already withdrawn');

  const agent = agents.get(inv.agent_id);
  if (!agent) throw new Error('Agent not found');

  // Current value = share_pct / 100 * agent.capital_balance
  const currentValue = (inv.share_pct / 100) * agent.capital_balance;
  const feeAmount = currentValue * 0.05; // 5% rage quit fee
  const netAmount = currentValue - feeAmount;

  // Reduce agent capital by gross withdrawal (fee stays split: 2.5% treasury, 2.5% platform)
  agent.capital_balance = Math.max(0, agent.capital_balance - currentValue);
  agent.updated_at = now();

  inv.status = 'withdrawn';
  inv.withdrawn_at = now();

  return { investment: { ...inv }, netAmount, feeAmount };
}

/* ─── Chat Messages ─── */

export function mockAddChatMessage(input: {
  agentId: string;
  userId: string;
  walletAddress: string;
  role: ChatRole;
  content: string;
  isOverride?: boolean;
  overrideData?: ParsedRules | null;
  overrideStatus?: OverrideStatus | null;
}): ChatMessage {
  const msg: ChatMessage = {
    id: uuid(),
    agent_id: input.agentId,
    user_id: input.userId,
    wallet_address: input.walletAddress,
    role: input.role,
    content: input.content,
    is_override: input.isOverride ?? false,
    override_data: input.overrideData ?? null,
    override_status: input.overrideStatus ?? null,
    created_at: now(),
  };

  const existing = store.chatMessages.get(input.agentId) ?? [];
  existing.push(msg);
  // Keep last 50 per agent
  if (existing.length > 50) existing.splice(0, existing.length - 50);
  store.chatMessages.set(input.agentId, existing);

  return { ...msg };
}

export function mockGetChatMessages(agentId: string, limit = 50): ChatMessage[] {
  const msgs = store.chatMessages.get(agentId) ?? [];
  return [...msgs].slice(-limit);
}

export function mockUpdateChatOverrideStatus(messageId: string, agentId: string, status: OverrideStatus): ChatMessage | null {
  const msgs = store.chatMessages.get(agentId);
  if (!msgs) return null;
  const msg = msgs.find((m) => m.id === messageId);
  if (!msg) return null;
  msg.override_status = status;
  return { ...msg };
}

/* ─── Loot Records ─── */

export function mockRecordLoot(agentId: string, userId: string): void {
  const existing = store.lootRecords.get(agentId) ?? new Set<string>();
  existing.add(userId);
  store.lootRecords.set(agentId, existing);
}

export function mockHasLooted(agentId: string, userId: string): boolean {
  return store.lootRecords.get(agentId)?.has(userId) ?? false;
}

export function mockGetAllDeadAgents(): Agent[] {
  return [...agents.values()]
    .filter((a) => a.status === 'dead')
    .sort((a, b) => (b.died_at ?? '').localeCompare(a.died_at ?? ''));
}

/* ─── Strategy Version History ─── */

export interface StrategyVersion {
  id: string;
  agent_id: string;
  version: number;
  prompt: string;
  parsed_rules: ParsedRules;
  created_at: string;
}

export function mockAddStrategyVersion(agentId: string, prompt: string, parsedRules: ParsedRules): StrategyVersion {
  const versions = store.strategyVersions.get(agentId) ?? [];
  const version: StrategyVersion = {
    id: uuid(),
    agent_id: agentId,
    version: versions.length + 1,
    prompt,
    parsed_rules: JSON.parse(JSON.stringify(parsedRules)),
    created_at: now(),
  };
  versions.push(version);
  store.strategyVersions.set(agentId, versions);
  return version;
}

export function mockGetStrategyVersions(agentId: string): StrategyVersion[] {
  return [...(store.strategyVersions.get(agentId) ?? [])].sort(
    (a, b) => b.version - a.version
  );
}

/* ─── PVPAI Points CRUD ─── */

export function mockUpdateUserPoints(userId: string, delta: number): User {
  const user = users.get(userId);
  if (!user) throw new Error('User not found');
  user.pvpai_points = Math.max(0, user.pvpai_points + delta);
  user.updated_at = now();
  return { ...user };
}

export function mockGetUserPoints(userId: string): number {
  const user = users.get(userId);
  return user?.pvpai_points ?? 0;
}

/* ─── Referral Tracking ─── */

export interface ReferralClick {
  id: string;
  referral_code: string;
  visitor_wallet: string | null;
  rewarded: boolean;
  points_awarded: number;
  created_at: string;
}

export function mockRecordReferralClick(referralCode: string, visitorWallet: string | null): ReferralClick {
  const clicks = store.referralClicks.get(referralCode) ?? [];
  const click: ReferralClick = {
    id: uuid(),
    referral_code: referralCode,
    visitor_wallet: visitorWallet,
    rewarded: false,
    points_awarded: 0,
    created_at: now(),
  };
  clicks.push(click);
  store.referralClicks.set(referralCode, clicks);
  return click;
}

export function mockRewardReferral(referralCode: string, visitorWallet: string, points: number): boolean {
  const clicks = store.referralClicks.get(referralCode) ?? [];
  // Find unrewarded click from this wallet
  const click = clicks.find((c) => c.visitor_wallet === visitorWallet && !c.rewarded);
  if (!click) return false;

  // Find the referrer user
  const allUsers = [...users.values()];
  const referrer = allUsers.find((u) => u.referral_code === referralCode);
  if (!referrer) return false;

  // Award points
  click.rewarded = true;
  click.points_awarded = points;
  mockUpdateUserPoints(referrer.id, points);
  return true;
}

export function mockGetReferralClicks(referralCode: string): ReferralClick[] {
  return [...(store.referralClicks.get(referralCode) ?? [])].sort(
    (a, b) => b.created_at.localeCompare(a.created_at)
  );
}

/* ─── Demo Seed Data ─── */

interface SeedAgent {
  name: string;
  prompt: string;
  assets: string[];
  direction: 'long' | 'short' | 'both';
  tier: 'scout' | 'sniper' | 'predator';
  keywords: string[];
  description: string;
  pnl: number;
  trades: number;
  winRate: number;
  capital: number;
  allocated: number;
  status: Agent['status'];
  daysAgo: number;
}

const SEED_AGENTS: SeedAgent[] = [
  // ─── NVDA ───
  {
    name: 'Jensen Tracker',
    prompt: 'Short NVDA when Jensen Huang sells stock or when earnings miss.',
    assets: ['xyz:NVDA'], direction: 'short', tier: 'predator',
    keywords: ['Jensen Huang', 'insider selling', 'earnings miss'],
    description: 'Shorts NVDA on insider selling signals and earnings misses.',
    pnl: 2340, trades: 47, winRate: 68, capital: 5200, allocated: 3000, status: 'active', daysAgo: 14,
  },
  {
    name: 'NVDA Dip Buyer',
    prompt: 'Buy NVDA when it drops 3%+ in a day with 3x leverage.',
    assets: ['xyz:NVDA'], direction: 'long', tier: 'sniper',
    keywords: ['dip', 'daily drop', 'oversold', 'buy the dip'],
    description: 'Buys NVDA dips with leverage when daily decline exceeds 3%.',
    pnl: 890, trades: 23, winRate: 61, capital: 2100, allocated: 1500, status: 'active', daysAgo: 10,
  },
  // ─── AAPL ───
  {
    name: 'Apple Earnings Sniper',
    prompt: 'Long AAPL before earnings if iPhone sales data is positive.',
    assets: ['xyz:AAPL'], direction: 'long', tier: 'sniper',
    keywords: ['iPhone sales', 'earnings', 'Apple', 'revenue beat'],
    description: 'Goes long AAPL ahead of earnings on positive iPhone data.',
    pnl: 1560, trades: 31, winRate: 65, capital: 3800, allocated: 2500, status: 'active', daysAgo: 18,
  },
  {
    name: 'Tim Cook Watcher',
    prompt: 'Short AAPL when antitrust rulings or App Store regulation news breaks.',
    assets: ['xyz:AAPL'], direction: 'short', tier: 'scout',
    keywords: ['antitrust', 'App Store', 'regulation', 'DOJ', 'EU fine'],
    description: 'Shorts AAPL on regulatory and antitrust headwinds.',
    pnl: -320, trades: 15, winRate: 40, capital: 680, allocated: 1000, status: 'active', daysAgo: 7,
  },
  // ─── TSLA ───
  {
    name: 'Elon Tweet Trader',
    prompt: 'Trade TSLA based on Elon Musk tweets and social media sentiment.',
    assets: ['xyz:TSLA'], direction: 'both', tier: 'predator',
    keywords: ['Elon Musk', 'tweet', 'Tesla', 'DOGE', 'X post'],
    description: 'Trades TSLA volatility driven by Elon Musk social media activity.',
    pnl: 4120, trades: 89, winRate: 57, capital: 8200, allocated: 4000, status: 'active', daysAgo: 21,
  },
  {
    name: 'TSLA Bear Thesis',
    prompt: 'Short TSLA when delivery numbers miss or competition gains share.',
    assets: ['xyz:TSLA'], direction: 'short', tier: 'sniper',
    keywords: ['delivery miss', 'BYD', 'EV competition', 'margin compression'],
    description: 'Shorts TSLA on delivery misses and rising EV competition.',
    pnl: -890, trades: 28, winRate: 36, capital: 110, allocated: 1000, status: 'active', daysAgo: 12,
  },
  // ─── META ───
  {
    name: 'Meta AI Bull',
    prompt: 'Long META when AI product launches or ad revenue beats expectations.',
    assets: ['xyz:META'], direction: 'long', tier: 'sniper',
    keywords: ['Llama', 'AI launch', 'ad revenue', 'Reels', 'Meta AI'],
    description: 'Goes long META on AI product momentum and ad revenue beats.',
    pnl: 1780, trades: 34, winRate: 62, capital: 4100, allocated: 2800, status: 'active', daysAgo: 16,
  },
  {
    name: 'Zuck Reality Check',
    prompt: 'Short META when Reality Labs losses spike or user growth stalls.',
    assets: ['xyz:META'], direction: 'short', tier: 'scout',
    keywords: ['Reality Labs', 'metaverse', 'user decline', 'VR headset'],
    description: 'Shorts META on Reality Labs cash burn and metaverse skepticism.',
    pnl: 210, trades: 12, winRate: 58, capital: 1210, allocated: 1000, status: 'active', daysAgo: 5,
  },
  // ─── AMZN ───
  {
    name: 'AWS Cloud Chaser',
    prompt: 'Long AMZN when AWS growth accelerates or cloud spending increases.',
    assets: ['xyz:AMZN'], direction: 'long', tier: 'predator',
    keywords: ['AWS', 'cloud spending', 'enterprise AI', 'revenue growth'],
    description: 'Rides AMZN long on AWS cloud infrastructure demand.',
    pnl: 3200, trades: 41, winRate: 71, capital: 7500, allocated: 4500, status: 'active', daysAgo: 25,
  },
  // ─── MSFT ───
  {
    name: 'Copilot Catalyst',
    prompt: 'Long MSFT when Copilot adoption metrics beat or Azure grows 30%+.',
    assets: ['xyz:MSFT'], direction: 'long', tier: 'sniper',
    keywords: ['Copilot', 'Azure', 'enterprise AI', 'Office 365'],
    description: 'Goes long MSFT on AI Copilot adoption and Azure growth beats.',
    pnl: 950, trades: 19, winRate: 63, capital: 2950, allocated: 2000, status: 'active', daysAgo: 11,
  },
  // ─── GOOG ───
  {
    name: 'Gemini Scalper',
    prompt: 'Trade GOOG around Gemini AI announcements and search market share data.',
    assets: ['xyz:GOOG'], direction: 'both', tier: 'scout',
    keywords: ['Gemini', 'search share', 'Google AI', 'DeepMind'],
    description: 'Scalps GOOG volatility around AI model releases and search metrics.',
    pnl: 430, trades: 52, winRate: 54, capital: 1430, allocated: 1000, status: 'active', daysAgo: 9,
  },
  // ─── AMD ───
  {
    name: 'AMD Momentum',
    prompt: 'Long AMD when MI300 chip orders increase or data center revenue beats.',
    assets: ['xyz:AMD'], direction: 'long', tier: 'sniper',
    keywords: ['MI300', 'data center', 'AI chips', 'Lisa Su'],
    description: 'Longs AMD on AI chip order momentum and data center beats.',
    pnl: 1120, trades: 26, winRate: 62, capital: 3100, allocated: 2000, status: 'active', daysAgo: 13,
  },
  // ─── COIN ───
  {
    name: 'Crypto Proxy',
    prompt: 'Long COIN when Bitcoin breaks new highs or crypto ETF inflows spike.',
    assets: ['xyz:COIN'], direction: 'long', tier: 'scout',
    keywords: ['Bitcoin ATH', 'crypto ETF', 'Coinbase', 'trading volume'],
    description: 'Uses COIN as a leveraged crypto proxy on BTC momentum.',
    pnl: -150, trades: 18, winRate: 44, capital: 850, allocated: 1000, status: 'active', daysAgo: 6,
  },
  // ─── PLTR ───
  {
    name: 'Palantir Warp',
    prompt: 'Long PLTR when government contracts awarded or AIP revenue grows.',
    assets: ['xyz:PLTR'], direction: 'long', tier: 'predator',
    keywords: ['government contract', 'AIP', 'defense', 'Palantir'],
    description: 'Rides PLTR on defense contracts and AI Platform commercial traction.',
    pnl: 2800, trades: 35, winRate: 69, capital: 6300, allocated: 3500, status: 'active', daysAgo: 20,
  },
  // ─── NFLX ───
  {
    name: 'Netflix Binge',
    prompt: 'Long NFLX when subscriber growth beats or ad-tier revenue accelerates.',
    assets: ['xyz:NFLX'], direction: 'long', tier: 'scout',
    keywords: ['subscriber growth', 'ad tier', 'password sharing', 'content spend'],
    description: 'Goes long NFLX on subscriber beats and ad-tier monetization.',
    pnl: 560, trades: 14, winRate: 57, capital: 1560, allocated: 1000, status: 'active', daysAgo: 8,
  },
  // ─── DEAD AGENTS (Graveyard) ───
  {
    name: 'SNAP Yolo',
    prompt: 'Long SNAP when AR features launch. Max leverage, no stop loss.',
    assets: ['xyz:SNAP'], direction: 'long', tier: 'scout',
    keywords: ['AR', 'Snapchat', 'Gen Z', 'ad revenue'],
    description: 'Reckless SNAP longs on AR hype. No risk management.',
    pnl: -980, trades: 22, winRate: 27, capital: 0, allocated: 1000, status: 'dead', daysAgo: 4,
  },
  {
    name: 'INTC Copium',
    prompt: 'Long INTC on any foundry news or government CHIPS Act funding.',
    assets: ['xyz:INTC'], direction: 'long', tier: 'scout',
    keywords: ['CHIPS Act', 'foundry', 'Intel', 'Pat Gelsinger'],
    description: 'Desperate INTC longs hoping for a foundry turnaround. RIP.',
    pnl: -750, trades: 19, winRate: 32, capital: 0, allocated: 1000, status: 'dead', daysAgo: 3,
  },
  {
    name: 'Meme Stonk Degen',
    prompt: 'Long GME and AMC on any Reddit WallStreetBets spike.',
    assets: ['xyz:GME'], direction: 'long', tier: 'scout',
    keywords: ['WSB', 'Reddit', 'short squeeze', 'diamond hands', 'ape'],
    description: 'Pure degen meme stock plays. Burned through fuel in 48 hours.',
    pnl: -1200, trades: 31, winRate: 23, capital: 0, allocated: 500, status: 'dead', daysAgo: 2,
  },
  {
    name: 'BABA Bottom Fisher',
    prompt: 'Long BABA whenever it drops 5%+ expecting a China stimulus bounce.',
    assets: ['xyz:BABA'], direction: 'long', tier: 'sniper',
    keywords: ['China stimulus', 'Alibaba', 'Jack Ma', 'delisting fear'],
    description: 'Tried to catch the BABA falling knife. The knife won.',
    pnl: -1800, trades: 25, winRate: 28, capital: 0, allocated: 2000, status: 'dead', daysAgo: 6,
  },
  {
    name: 'RIVN Bull Trap',
    prompt: 'Long RIVN on any EV delivery beat or Amazon van partnership news.',
    assets: ['xyz:RIVN'], direction: 'long', tier: 'scout',
    keywords: ['Rivian', 'EV delivery', 'Amazon vans', 'production ramp'],
    description: 'Got trapped in RIVN longs as cash burn exceeded revenue.',
    pnl: -620, trades: 16, winRate: 31, capital: 0, allocated: 800, status: 'dead', daysAgo: 5,
  },
];

function seedDemoData(): void {
  if (store.seeded) return;
  store.seeded = true;

  // Create a demo "system" user for seeded agents
  const systemUserId = uuid();
  const systemUser: User = {
    id: systemUserId,
    wallet_address: '0x0000000000000000000000000000000000000000',
    display_name: 'PVP AI System',
    referral_code: 'SYSTEM',
    referred_by: null,
    balance_usdt: 0,
    pvpai_points: 0,
    created_at: now(),
    updated_at: now(),
  };
  users.set(systemUser.id, systemUser);
  usersByWallet.set(systemUser.wallet_address, systemUser.id);

  // Create 5 additional "creator" users for variety
  const creatorWallets = [
    '0xd3adb33f1234567890abcdef1234567890abcdef',
    '0xc0ffee1234567890abcdef1234567890abcdef01',
    '0xbeef1234567890abcdef1234567890abcdef0123',
    '0xface1234567890abcdef1234567890abcdef0456',
    '0xdead1234567890abcdef1234567890abcdef0789',
  ];
  const creatorIds: string[] = [];
  for (const wallet of creatorWallets) {
    const { user } = mockFindOrCreateUser(wallet);
    creatorIds.push(user.id);
  }

  for (const seed of SEED_AGENTS) {
    const creatorId = creatorIds[Math.floor(Math.random() * creatorIds.length)];
    const createdAt = new Date(Date.now() - seed.daysAgo * 86400000).toISOString();
    const diedAt = seed.status === 'dead'
      ? new Date(Date.now() - (seed.daysAgo - 1) * 86400000).toISOString()
      : null;

    const burnRate = seed.tier === 'predator' ? 20.833333
      : seed.tier === 'sniper' ? 4.166667
      : 0.416667;

    // Generate a deterministic wallet address from seed name
    const walletHash = Array.from(seed.name + seed.assets[0])
      .reduce((h, c) => ((h * 31 + c.charCodeAt(0)) >>> 0), 0);
    const walletHex = walletHash.toString(16).padStart(8, '0').repeat(5);
    const aiWallet = '0x' + walletHex.slice(0, 40);

    const agent: Agent = {
      id: uuid(),
      user_id: creatorId,
      name: seed.name,
      prompt: seed.prompt,
      ai_wallet: aiWallet,
      parsed_rules: {
        name: seed.name,
        description: seed.description,
        assets: seed.assets,
        direction_bias: seed.direction,
        triggers: [
          { type: 'keyword', condition: seed.keywords[0], parameters: {} },
          { type: 'momentum', condition: 'price_action_trigger', parameters: {} },
        ],
        risk_management: {
          max_position_size_pct: 100,
          stop_loss_pct: seed.tier === 'predator' ? 3 : seed.tier === 'sniper' ? 5 : 8,
          take_profit_pct: seed.tier === 'predator' ? 10 : seed.tier === 'sniper' ? 15 : 20,
          max_leverage: seed.tier === 'predator' ? 5 : seed.tier === 'sniper' ? 3 : 2,
          max_daily_trades: seed.tier === 'predator' ? 10 : seed.tier === 'sniper' ? 5 : 3,
        },
        keywords: seed.keywords,
        tier: seed.tier,
      },
      avatar_seed: uuid(),
      avatar_url: null,
      status: seed.status,
      allocated_funds: seed.allocated,
      energy_balance: seed.status === 'dead' ? 0 : 500 + Math.random() * 2000,
      capital_balance: seed.capital,
      burn_rate_per_hour: burnRate,
      died_at: diedAt,
      clone_parent_id: null,
      creator_earnings: 0,
      total_trades: seed.trades,
      total_pnl: seed.pnl,
      win_rate: seed.winRate,
      created_at: createdAt,
      updated_at: now(),
    };
    agents.set(agent.id, agent);

    // Add lobby event for each agent
    store.lobbyEvents.push({
      id: uuid(),
      type: seed.status === 'dead' ? 'agent_died' : 'agent_born',
      agent_id: agent.id,
      agent_name: seed.name,
      data: { tier: seed.tier },
      created_at: createdAt,
    });
  }

  // Add some trade events to the ticker
  const activeAgents = [...agents.values()].filter((a) => a.status === 'active');
  const directions: ('long' | 'short')[] = ['long', 'short'];
  for (let i = 0; i < 15; i++) {
    const a = activeAgents[Math.floor(Math.random() * activeAgents.length)];
    const pnl = Math.round((Math.random() * 2000 - 600) * 100) / 100;
    store.lobbyEvents.push({
      id: uuid(),
      type: pnl >= 0 ? 'trade_closed' : 'trade_closed',
      agent_id: a.id,
      agent_name: a.name,
      data: {
        symbol: (a.parsed_rules?.assets ?? ['BTC'])[0],
        direction: directions[Math.floor(Math.random() * 2)],
        pnl,
        size: Math.round(100 + Math.random() * 2000),
      },
      created_at: new Date(Date.now() - Math.random() * 3600000).toISOString(),
    });
  }
}

// Auto-seed on store creation
seedDemoData();
