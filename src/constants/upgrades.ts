import type { AgentTier } from './trading';

export interface UpgradePath {
  from: AgentTier;
  to: AgentTier;
  cost_usdc: number;
  label: string;
}

export const UPGRADE_PATHS: UpgradePath[] = [
  { from: 'scout', to: 'sniper', cost_usdc: 0, label: 'Scout → Sniper' },
  { from: 'sniper', to: 'predator', cost_usdc: 0, label: 'Sniper → Predator' },
];

/** Ordered tiers from lowest to highest */
export const TIER_ORDER: AgentTier[] = ['scout', 'sniper', 'predator'];

export function canUpgrade(currentTier: AgentTier): boolean {
  return currentTier !== 'predator';
}

export function getNextTier(currentTier: AgentTier): AgentTier | null {
  const idx = TIER_ORDER.indexOf(currentTier);
  if (idx === -1 || idx >= TIER_ORDER.length - 1) return null;
  return TIER_ORDER[idx + 1];
}

export function getUpgradeCost(from: AgentTier, to: AgentTier): number | null {
  const path = UPGRADE_PATHS.find((p) => p.from === from && p.to === to);
  return path ? path.cost_usdc : null;
}
