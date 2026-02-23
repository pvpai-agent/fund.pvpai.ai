import { createPublicClient, http, type Address } from 'viem';
import { bsc } from 'viem/chains';
import { USDC_ADDRESSES, PLATFORM_WALLET } from '@/constants/contracts';

export async function verifyOnChainPayment(
  txHash: string,
  expectedAmountUsd: number,
  expectedSender?: string
): Promise<{ verified: boolean; from: Address | null; amount: number }> {
  const client = createPublicClient({
    chain: bsc,
    transport: http('https://bsc-dataseed.binance.org/'),
  });

  try {
    const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
    if (receipt.status !== 'success') {
      return { verified: false, from: null, amount: 0 };
    }

    const tokenAddress = USDC_ADDRESSES[56];
    const transferLogs = receipt.logs.filter(
      (log) =>
        log.address.toLowerCase() === tokenAddress?.toLowerCase() &&
        log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
    );

    for (const log of transferLogs) {
      const to = ('0x' + log.topics[2]?.slice(26)) as Address;
      if (to.toLowerCase() === PLATFORM_WALLET.toLowerCase()) {
        const rawValue = BigInt(log.data);
        const amount = Number(rawValue) / 10 ** 18; // BSC USDC is 18 decimals
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
