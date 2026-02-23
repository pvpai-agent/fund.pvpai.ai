export type LobbyEventType = 'trade_opened' | 'trade_closed' | 'agent_died' | 'agent_born';

export interface LobbyEvent {
  id: string;
  type: LobbyEventType;
  agent_id: string;
  agent_name: string;
  /** Extra data depending on event type */
  data: {
    symbol?: string;
    direction?: 'long' | 'short';
    pnl?: number;
    size?: number;
    tier?: string;
  };
  created_at: string;
}
