import type { ParsedRules } from './database';

export type ChatRole = 'user' | 'agent' | 'system';
export type OverrideStatus = 'pending' | 'confirmed' | 'rejected';

export interface ChatMessage {
  id: string;
  agent_id: string;
  user_id: string;
  wallet_address: string;
  role: ChatRole;
  content: string;
  /** Whether this message contains a strategy override proposal */
  is_override: boolean;
  /** Proposed new rules (agent messages only) */
  override_data: ParsedRules | null;
  /** Override confirmation status */
  override_status: OverrideStatus | null;
  created_at: string;
}
