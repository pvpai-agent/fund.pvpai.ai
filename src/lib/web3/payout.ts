import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  type Address,
  type Hash,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc } from 'viem/chains';
import { USDC_ADDRESSES, ERC20_ABI } from '@/constants/contracts';
import { ensureBscFunds } from './bridge';

const BSC_RPC = 'https://bsc-dataseed.binance.org/';

export interface PayoutResult {
  txHash: Hash;
  amount: number;
  /** Always BSC — cross-chain bridge handles the rest */
  chain: 'bsc';
}

/**
 * Send USDC payout to a user's wallet on BSC.
 *
 * Strategy:
 * 1. Check BSC USDC balance — if enough, send directly (instant)
 * 2. Otherwise, auto-bridge: Hyperliquid → Arbitrum → cBridge → BSC, then send
 */
export async function sendUsdcPayout(
  toAddress: string,
  amountUsd: number
): Promise<PayoutResult> {
  const privateKey = process.env.HYPERLIQUID_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('HYPERLIQUID_PRIVATE_KEY not configured — on-chain payout unavailable');
  }

  // ── Try BSC first (already have balance) ──
  const bscResult = await trySendOnBsc(privateKey, toAddress, amountUsd);
  if (bscResult) return { ...bscResult, chain: 'bsc' };

  // ── BSC insufficient → bridge from HL/Arbitrum to BSC ──
  console.log(`[Payout] BSC USDC insufficient for $${amountUsd}, initiating cross-chain bridge...`);
  await ensureBscFunds(amountUsd);

  // Retry BSC send after bridge
  const retryResult = await trySendOnBsc(privateKey, toAddress, amountUsd);
  if (!retryResult) {
    throw new Error(`BSC USDC still insufficient after bridge — bridge delivery may have failed`);
  }

  return { ...retryResult, chain: 'bsc' };
}

/**
 * Attempt to send USDC on BSC. Returns null if balance insufficient.
 */
async function trySendOnBsc(
  privateKey: string,
  toAddress: string,
  amountUsd: number
): Promise<{ txHash: Hash; amount: number } | null> {
  const tokenAddress = USDC_ADDRESSES[56];
  if (!tokenAddress) return null;

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const publicClient = createPublicClient({ chain: bsc, transport: http(BSC_RPC) });

  // BSC USDC has 18 decimals
  const parsedAmount = parseUnits(amountUsd.toString(), 18);

  const balance = await publicClient.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  }) as bigint;

  if (balance < parsedAmount) {
    console.log(
      `[Payout] BSC USDC: $${Number(formatUnits(balance, 18)).toFixed(2)} < $${amountUsd} needed`
    );
    return null; // Not enough on BSC
  }

  const walletClient = createWalletClient({
    account,
    chain: bsc,
    transport: http(BSC_RPC),
  });

  const txHash = await walletClient.writeContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [toAddress as Address, parsedAmount],
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: 3,
    timeout: 60_000,
  });

  if (receipt.status !== 'success') {
    throw new Error(`BSC payout transaction failed: ${txHash}`);
  }

  console.log(`[Payout] Sent $${amountUsd} USDC on BSC → ${toAddress} (tx: ${txHash})`);
  return { txHash, amount: amountUsd };
}

/**
 * Check if on-chain payout is available (private key configured).
 */
export function isPayoutConfigured(): boolean {
  return !!process.env.HYPERLIQUID_PRIVATE_KEY;
}
