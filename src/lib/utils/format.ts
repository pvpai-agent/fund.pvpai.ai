export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPnl(amount: number): string {
  const prefix = amount >= 0 ? '+' : '';
  return `${prefix}${formatUsd(amount)}`;
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function formatNumber(num: number, decimals = 2): string {
  if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (Math.abs(num) >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toFixed(decimals);
}

/** Convert internal PVP points to USD value (100 PVP = $1) */
export function pvpToUsd(pvp: number): number {
  return pvp / 100;
}

/** Format PVP amount as a dollar fuel value, e.g. "$5.00" */
export function formatFuel(pvpAmount: number): string {
  return formatUsd(pvpToUsd(pvpAmount));
}

/** @deprecated Use formatFuel instead */
export function formatPvp(amount: number): string {
  return formatFuel(amount);
}

/** @deprecated Use formatFuel instead */
export function formatPvpWithUsd(pvp: number): string {
  return formatFuel(pvp);
}

/** @deprecated Use formatFuel instead */
export function formatEnergy(points: number): string {
  return formatFuel(points);
}

export function formatLifespan(hours: number): string {
  if (!isFinite(hours)) return 'Indefinite';
  if (hours >= 24) return `${(hours / 24).toFixed(1)}d`;
  if (hours >= 1) return `${hours.toFixed(1)}h`;
  return `${(hours * 60).toFixed(0)}m`;
}

/** Pure function — safe for client components */
export function estimateLifespan(energyBalance: number, burnRatePerHour: number): number {
  if (burnRatePerHour <= 0) return Infinity;
  return energyBalance / burnRatePerHour;
}
