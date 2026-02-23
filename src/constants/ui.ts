export const UI = {
  ANIMATION_DURATION: {
    fast: 0.15,
    normal: 0.3,
    slow: 0.5,
    typewriter: 2,
  },
  TERMINAL: {
    maxLines: 100,
    scrollDelay: 50,
    cursorChar: '\u2588',
  },
  COLORS: {
    profit: '#00ff41',
    loss: '#ff0040',
    neutral: '#00d4ff',
    gold: '#ffd700',
    warning: '#ff6600',
    energy: '#ff00ff',
    dead: '#666666',
    critical: '#ff3300',
  },
  CONFETTI: {
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#ffd700', '#ffb300', '#ff8c00', '#00ff41'],
  },
} as const;

export const TERMINAL_MESSAGES = {
  scanning: [
    '[SCAN] Monitoring market data...',
    '[SCAN] Checking latest financial news...',
    '[SCAN] Analyzing price patterns...',
    '[SCAN] Scanning social sentiment...',
    '[SCAN] Processing market microstructure...',
  ],
  idle: [
    '[IDLE] Agent standing by...',
    '[IDLE] Awaiting trigger conditions...',
    '[IDLE] All systems operational...',
  ],
  trigger: (reason: string) => `[TRIGGER] Signal detected: ${reason}`,
  execute: (direction: string, size: number) => `[EXEC] Opening ${direction.toUpperCase()} position | Size: $${size.toFixed(2)}`,
  profit: (pnl: number) => `[PROFIT] +$${pnl.toFixed(2)} realized`,
  loss: (pnl: number) => `[LOSS] -$${Math.abs(pnl).toFixed(2)} realized`,
  energy: {
    burn: (amount: number) => `[METABOLISM] -${amount.toFixed(0)} energy consumed`,
    feed: (amount: number, hours: number) => `[VAMPIRE] +${amount.toFixed(0)} energy extracted. Lifespan +${hours.toFixed(1)}h`,
    critical: (hours: number) => `[WARNING] Energy critical! ~${hours.toFixed(1)}h remaining`,
    death: '[K.I.A.] Energy depleted. Agent terminated.',
    bloodPack: (amount: number) => `[BLOOD PACK] +${amount.toFixed(0)} energy from referral`,
  },
} as const;
