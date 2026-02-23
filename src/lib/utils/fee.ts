import { TRADING } from '@/constants/trading';

export interface FeeBreakdown {
  grossPnl: number;
  performanceFee: number;
  creatorFee: number;
  platformFee: number;
  referrerFee: number;
  /** PnL that flows back into the agent's capital pool (80% of gross) */
  netPnl: number;
}

export function calculateFees(grossPnl: number, _hasReferrer: boolean): FeeBreakdown {
  if (grossPnl <= 0) {
    return { grossPnl, performanceFee: 0, creatorFee: 0, platformFee: 0, referrerFee: 0, netPnl: grossPnl };
  }

  // 20% total performance fee: 10% creator alpha fee + 10% platform fee
  const performanceFee = grossPnl * (TRADING.PERFORMANCE_FEE_PCT / 100);
  const creatorFee = performanceFee / 2;   // 10% of gross
  const platformFee = performanceFee / 2;  // 10% of gross
  const referrerFee = 0;

  return { grossPnl, performanceFee, creatorFee, platformFee, referrerFee, netPnl: grossPnl - performanceFee };
}
