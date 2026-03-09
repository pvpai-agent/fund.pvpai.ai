'use client';

import { useReadContract, useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { USDC_ADDRESSES, USDC_DECIMALS, ERC20_ABI } from '@/constants/contracts';
import { DEFAULT_CHAIN_ID, isSupportedChainId } from '@/constants/chains';

/**
 * Reads the user's on-chain USDC balance on the active supported chain.
 */
export function useUsdcBalance() {
  const { address, chainId: currentChainId } = useAccount();
  const chainId = isSupportedChainId(currentChainId) ? currentChainId : DEFAULT_CHAIN_ID;
  const tokenAddress = USDC_ADDRESSES[chainId];
  const decimals = USDC_DECIMALS[chainId] ?? 18;

  const { data, isLoading, refetch } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: !!address },
  });

  const balance = data ? Number(formatUnits(data as bigint, decimals)) : 0;

  return { balance, isLoading, refetch, chainId };
}
