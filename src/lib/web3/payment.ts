import { createPublicClient, http, type Address, type Chain } from 'viem';
import { bsc, monad } from 'viem/chains';
import { DEFAULT_CHAIN_ID, isSupportedChainId } from '@/constants/chains';
import { USDC_ADDRESSES, USDC_DECIMALS, PLATFORM_WALLET } from '@/constants/contracts';

const CHAIN_BY_ID: Record<number, Chain> = {
  [bsc.id]: bsc,
  [monad.id]: monad,
};

const RPC_BY_CHAIN_ID: Record<number, string> = {
  [bsc.id]: process.env.NEXT_PUBLIC_BSC_RPC_URL ?? 'https://bsc-dataseed.binance.org/',
  [monad.id]: process.env.NEXT_PUBLIC_MONAD_RPC_URL ?? 'https://rpc.monad.xyz',
};

export async function verifyOnChainPayment(
  txHash: string,
  expectedAmountUsd: number,
  expectedSender?: string,
  chainId: number = DEFAULT_CHAIN_ID
): Promise<{ verified: boolean; from: Address | null; amount: number }> {
  if (!isSupportedChainId(chainId)) {
    return { verified: false, from: null, amount: 0 };
  }

  const chain = CHAIN_BY_ID[chainId];
  const rpcUrl = RPC_BY_CHAIN_ID[chainId];
  const tokenAddress = USDC_ADDRESSES[chainId];
  const tokenDecimals = USDC_DECIMALS[chainId];
  if (!chain || !rpcUrl || !tokenAddress || typeof tokenDecimals !== 'number') {
    return { verified: false, from: null, amount: 0 };
  }

  const client = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  try {
    const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
    if (receipt.status !== 'success') {
      return { verified: false, from: null, amount: 0 };
    }

    const transferLogs = receipt.logs.filter(
      (log) =>
        log.address.toLowerCase() === tokenAddress?.toLowerCase() &&
        log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
    );

    for (const log of transferLogs) {
      const to = ('0x' + log.topics[2]?.slice(26)) as Address;
      if (to.toLowerCase() === PLATFORM_WALLET.toLowerCase()) {
        const rawValue = BigInt(log.data);
        const amount = Number(rawValue) / 10 ** tokenDecimals;
        if (amount >= expectedAmountUsd * 0.995) { // 0.5% tolerance (tighter)
          const from = ('0x' + log.topics[1]?.slice(26)) as Address;

          // Validate sender matches the authenticated wallet
          if (expectedSender && from.toLowerCase() !== expectedSender.toLowerCase()) {
            return { verified: false, from, amount: 0 };
          }

          return { verified: true, from, amount };
        }
      }
    }

    return { verified: false, from: null, amount: 0 };
  } catch {
    return { verified: false, from: null, amount: 0 };
  }
}
