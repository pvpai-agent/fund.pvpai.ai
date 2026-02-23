import type { Agent, EnergyLog, ParsedRules, Trade, Transaction, User } from './database';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface VerifyWalletRequest {
  walletAddress: string;
  signature: string;
  message: string;
}

export interface VerifyWalletResponse {
  user: User;
  isNew: boolean;
}

export interface CreateAgentRequest {
  name: string;
  prompt: string;
  parsedRules: ParsedRules;
  mintAmount: number;
  avatarSeed: string;
}

export interface MintAgentRequest {
  walletAddress: string;
  txHash: string;
  name: string;
  prompt: string;
  parsedRules: ParsedRules;
  avatarSeed: string;
  mintAmount: number;
}

export interface ParseStrategyRequest {
  prompt: string;
}

export interface ParseStrategyResponse {
  parsedRules: ParsedRules;
}

export interface VerifyPaymentRequest {
  txHash: string;
  chain: 'bsc';
  type: 'agent_mint' | 'deposit' | 'energy_topup';
  amount?: number;
}

export interface ExecuteTradeRequest {
  agentId: string;
  direction: 'long' | 'short';
  triggerReason: string;
  triggerData?: Record<string, unknown>;
}

export interface AgentEnergyData {
  energy_balance: number;
  burn_rate_per_hour: number;
  estimated_lifespan_hours: number;
  is_critical: boolean;
  is_dead: boolean;
  died_at: string | null;
  logs: EnergyLog[];
}

export interface ResurrectAgentRequest {
  agentId: string;
  walletAddress: string;
  amount: number;
}

export interface RechargeRequest {
  walletAddress: string;
  txHash: string;
  amount: number;
}

export interface UserDashboardData {
  user: User;
  agents: Agent[];
  recentTrades: Trade[];
  recentTransactions: Transaction[];
}
