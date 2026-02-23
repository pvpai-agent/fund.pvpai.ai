'use client';

import type { LobbyEvent } from '@/types/events';

// Rich FOMO-style mock events that always show, even when lobby is quiet
const MOCK_EVENTS = [
  { icon: '🔥', text: '0x4B2...8f1a invested $500 in $JSEN', color: 'text-cyber-gold' },
  { icon: '⚡', text: '$BTCHUNTER printed +45% ROI!', color: 'text-cyber-green' },
  { icon: '💀', text: '$PEPE short just starved to death...', color: 'text-cyber-red' },
  { icon: '🚀', text: '0xdEaD...b33f deployed $TSLAQ [PREDATOR]', color: 'text-cyber-blue' },
  { icon: '💰', text: '$AWSC just closed +$3,200 on AMZN long', color: 'text-cyber-green' },
  { icon: '🆘', text: '$BEARISH has < 6 hours of fuel left!', color: 'text-cyber-orange' },
  { icon: '🔥', text: '0xc0FF...ee01 invested $1,200 in $PLTR', color: 'text-cyber-gold' },
  { icon: '⚡', text: '$ELONT flipped +$4,120 trading TSLA', color: 'text-cyber-green' },
  { icon: '💀', text: '$INTCOPE ran out of fuel. K.I.A.', color: 'text-cyber-red' },
  { icon: '🚀', text: '0xBEEF...0123 just looted $SNAPYOLO strategy for $10', color: 'text-cyber-purple' },
  { icon: '💰', text: '$METABULL riding META +$1,780 PnL', color: 'text-cyber-green' },
  { icon: '🔥', text: '0xFACE...0456 SOS-fed $COINPRX with $50 USDC', color: 'text-cyber-orange' },
];

function formatLiveEvent(event: LobbyEvent): { icon: string; text: string; color: string } {
  switch (event.type) {
    case 'trade_closed': {
      const pnl = event.data.pnl ?? 0;
      const sign = pnl >= 0 ? '+' : '';
      const symbol = (event.data.symbol ?? 'BTC').replace('xyz:', '');
      if (pnl >= 0) {
        return {
          icon: '💰',
          text: `$${event.agent_name} closed ${sign}$${pnl.toFixed(0)} on ${symbol}`,
          color: 'text-cyber-green',
        };
      }
      return {
        icon: '📉',
        text: `$${event.agent_name} lost $${Math.abs(pnl).toFixed(0)} on ${symbol}`,
        color: 'text-cyber-red',
      };
    }
    case 'agent_born':
      return {
        icon: '🚀',
        text: `$${event.agent_name} deployed [${(event.data.tier ?? 'scout').toUpperCase()}]`,
        color: 'text-cyber-blue',
      };
    case 'agent_died':
      return {
        icon: '💀',
        text: `$${event.agent_name} ran out of fuel. K.I.A.`,
        color: 'text-cyber-red',
      };
    case 'trade_opened': {
      const dir = event.data.direction === 'long' ? 'LONG' : 'SHORT';
      const symbol = (event.data.symbol ?? 'BTC').replace('xyz:', '');
      return {
        icon: '⚡',
        text: `$${event.agent_name} opened ${dir} on ${symbol}`,
        color: 'text-cyber-gold',
      };
    }
    default:
      return { icon: '*', text: `${event.agent_name} activity`, color: 'text-gray-400' };
  }
}

export function TickerTape({ events }: { events: LobbyEvent[] }) {
  // Convert live events to display format
  const liveItems = events.map(formatLiveEvent);

  // Merge: live events first, then pad with mock events
  const allItems = liveItems.length > 8
    ? liveItems
    : [...liveItems, ...MOCK_EVENTS.slice(0, Math.max(8, 12 - liveItems.length))];

  // Double for seamless infinite scroll
  const items = [...allItems, ...allItems];

  return (
    <div className="w-full bg-cyber-darker/90 border-y border-terminal-border overflow-hidden">
      <div className="animate-marquee flex items-center whitespace-nowrap py-2">
        {items.map((item, idx) => (
          <span
            key={idx}
            className="flex items-center gap-1.5 mx-4 text-xs font-mono shrink-0"
          >
            <span className="text-sm">{item.icon}</span>
            <span className={item.color}>{item.text}</span>
            <span className="text-gray-700 ml-2">|</span>
          </span>
        ))}
      </div>
    </div>
  );
}
