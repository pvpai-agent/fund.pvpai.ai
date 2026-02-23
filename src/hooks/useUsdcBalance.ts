'use client';

import { useReadContract, useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { USDC_ADDRESSES, ERC20_ABI } from '@/constants/contracts';

/**
 * Reads the user's on-chain USDC balance on BSC (chain 56).
 * BSC-pegged USDC uses 18 decimals.
 */
export function useUsdcBalance() {
  const { address } = useAccount();

  const { data, isLoading, refetch } = useReadContract({
    address: USDC_ADDRESSES[56],
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: 56,
    query: { enabled: !!address },
  });

  const balance = data ? Number(formatUnits(data as bigint, 18)) : 0;

  return { balance, isLoading, refetch };
}
