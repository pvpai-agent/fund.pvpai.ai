import { type Address, type PublicClient, parseUnits, formatUnits } from 'viem';
import { ERC20_ABI, USDC_ADDRESSES, PLATFORM_WALLET } from '@/constants/contracts';

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
  if (chainId !== 56) throw new Error(`Only BNB Chain (56) is supported. Got: ${chainId}`);

  const tokenAddress = USDC_ADDRESSES[56];
  if (!tokenAddress) throw new Error('USDC address not configured for BSC');

  const parsedAmount = parseUnits(amount.toString(), 18);

  return {
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'transfer' as const,
    args: [PLATFORM_WALLET, parsedAmount] as const,
  };
}
