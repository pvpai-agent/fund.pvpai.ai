import { type Address, type PublicClient, parseUnits, formatUnits } from 'viem';
import { ERC20_ABI, USDC_ADDRESSES, USDC_DECIMALS, PLATFORM_WALLET } from '@/constants/contracts';
import { getChainName, isSupportedChainId } from '@/constants/chains';

export async function getTokenBalance(
  client: PublicClient,
  tokenAddress: Address,
  walletAddress: Address
): Promise<string> {
  const balance = await client.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [walletAddress],
  });
  return formatUnits(balance as bigint, 18);
}

export function getTransferParams(chainId: number, amount: number) {
  if (!isSupportedChainId(chainId)) {
    throw new Error(`Unsupported chain (${chainId}). Use BNB Chain (56) or Monad (143).`);
  }

  const tokenAddress = USDC_ADDRESSES[chainId];
  const decimals = USDC_DECIMALS[chainId];
  if (!tokenAddress || typeof decimals !== 'number') {
    throw new Error(`USDC address not configured for ${getChainName(chainId)}`);
  }

  const parsedAmount = parseUnits(amount.toString(), decimals);

  return {
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'transfer' as const,
    args: [PLATFORM_WALLET, parsedAmount] as const,
  };
}
