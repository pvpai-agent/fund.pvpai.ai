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
import { arbitrum, bsc } from 'viem/chains';
import { ERC20_ABI, USDC_ADDRESSES } from '@/constants/contracts';

/** Arbitrum native USDC (6 decimals) — this is what Hyperliquid withdrawals deliver */
const ARB_USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as Address;
const ARB_USDC_DECIMALS = 6;
const ARB_RPC = 'https://arb1.arbitrum.io/rpc';

const BSC_RPC = 'https://bsc-dataseed.binance.org/';
const BSC_USDC_DECIMALS = 18;

/** Celer cBridge contract on Arbitrum */
const CBRIDGE_ARB = '0x1619DE6B6B20eD217a58d00f37B9d47C7663feca' as Address;

const CBRIDGE_SEND_ABI = [
  {
    name: 'send',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_receiver', type: 'address' },
      { name: '_token', type: 'address' },
      { name: '_amount', type: 'uint256' },
      { name: '_dstChainId', type: 'uint64' },
      { name: '_nonce', type: 'uint64' },
      { name: '_maxSlippage', type: 'uint32' },
    ],
    outputs: [],
  },
] as const;

function getAccount() {
  const pk = process.env.HYPERLIQUID_PRIVATE_KEY;
  if (!pk) throw new Error('HYPERLIQUID_PRIVATE_KEY not configured');
  return privateKeyToAccount(pk as `0x${string}`);
}

// ─── Hyperliquid withdrawal ────────────────────────────────────────

/**
 * Withdraw USDC from Hyperliquid to Arbitrum.
 * Uses the HL SDK's `initiateWithdrawal`. Funds arrive on Arbitrum in ~1-5 min.
 */
export async function withdrawFromHyperliquid(amount: number): Promise<void> {
  const { getHyperliquidClient } = await import('@/lib/hyperliquid/client');
  const hl = await getHyperliquidClient();
  const walletAddress = process.env.HYPERLIQUID_WALLET_ADDRESS;
  if (!walletAddress) throw new Error('HYPERLIQUID_WALLET_ADDRESS not configured');

  console.log(`[Bridge] Initiating HL withdrawal: $${amount} USDC → Arbitrum (${walletAddress})`);
  await hl.exchange.initiateWithdrawal(walletAddress, amount);
  console.log('[Bridge] HL withdrawal initiated, waiting for funds on Arbitrum...');
}

/**
 * Poll Arbitrum USDC balance until it reaches the target amount.
 */
export async function waitForArbitrumFunds(
  targetAmount: number,
  timeoutMs = 300_000,
  pollIntervalMs = 10_000
): Promise<number> {
  const account = getAccount();
  const client = createPublicClient({ chain: arbitrum, transport: http(ARB_RPC) });
  const target = parseUnits(targetAmount.toString(), ARB_USDC_DECIMALS);

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const balance = await client.readContract({
      address: ARB_USDC,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account.address],
    }) as bigint;

    if (balance >= target) {
      const balNum = Number(formatUnits(balance, ARB_USDC_DECIMALS));
      console.log(`[Bridge] Arbitrum USDC balance: $${balNum.toFixed(2)} (target: $${targetAmount})`);
      return balNum;
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  throw new Error(`Timed out waiting for $${targetAmount} USDC on Arbitrum`);
}

// ─── Balance helpers ───────────────────────────────────────────────

export async function getArbitrumUsdcBalance(): Promise<number> {
  const account = getAccount();
  const client = createPublicClient({ chain: arbitrum, transport: http(ARB_RPC) });

  const balance = await client.readContract({
    address: ARB_USDC,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  }) as bigint;

  return Number(formatUnits(balance, ARB_USDC_DECIMALS));
}

export async function getBscUsdcBalance(): Promise<number> {
  const account = getAccount();
  const tokenAddress = USDC_ADDRESSES[56];
  if (!tokenAddress) return 0;

  const client = createPublicClient({ chain: bsc, transport: http(BSC_RPC) });
  const balance = await client.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  }) as bigint;

  return Number(formatUnits(balance, BSC_USDC_DECIMALS));
}

// ─── Celer cBridge: Arbitrum → BSC ─────────────────────────────────

/**
 * Bridge USDC from Arbitrum to BSC via Celer cBridge.
 * Sends to our own wallet on BSC (same private key → same address on all EVM chains).
 * cBridge handles the Arbitrum USDC (6 dec) → BSC USDC (18 dec) conversion.
 */
export async function bridgeUsdcToBsc(amountUsd: number): Promise<Hash> {
  const account = getAccount();
  const publicClient = createPublicClient({ chain: arbitrum, transport: http(ARB_RPC) });
  const walletClient = createWalletClient({
    account,
    chain: arbitrum,
    transport: http(ARB_RPC),
  });

  const parsedAmount = parseUnits(amountUsd.toString(), ARB_USDC_DECIMALS);

  // 1. Approve USDC to cBridge if needed
  const currentAllowance = await publicClient.readContract({
    address: ARB_USDC,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [account.address, CBRIDGE_ARB],
  }) as bigint;

  if (currentAllowance < parsedAmount) {
    console.log(`[Bridge] Approving USDC to cBridge...`);
    const approveTx = await walletClient.writeContract({
      address: ARB_USDC,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [CBRIDGE_ARB, parsedAmount * BigInt(10)], // approve 10x to avoid frequent approvals
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx, confirmations: 1, timeout: 60_000 });
    console.log(`[Bridge] USDC approved (tx: ${approveTx})`);
  }

  // 2. Send via cBridge
  const nonce = BigInt(Date.now());
  console.log(`[Bridge] Bridging $${amountUsd} USDC: Arbitrum → BSC via cBridge (nonce: ${nonce})...`);

  const txHash = await walletClient.writeContract({
    address: CBRIDGE_ARB,
    abi: CBRIDGE_SEND_ABI,
    functionName: 'send',
    args: [
      account.address,  // receiver = our own wallet on BSC
      ARB_USDC,         // token on source chain
      parsedAmount,     // amount in Arbitrum USDC decimals (6)
      BigInt(56),       // destination chain = BSC
      nonce,            // unique nonce
      5000,             // max slippage 0.5% (cBridge uses 1M = 100%)
    ],
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: 2,
    timeout: 60_000,
  });

  if (receipt.status !== 'success') {
    throw new Error(`cBridge send transaction failed: ${txHash}`);
  }

  console.log(`[Bridge] cBridge send confirmed (tx: ${txHash}), waiting for BSC delivery...`);
  return txHash;
}

/**
 * Poll BSC USDC balance until it reaches the target amount.
 * Used after cBridge bridging — typically takes 5-20 minutes.
 */
export async function waitForBscFunds(
  targetAmount: number,
  timeoutMs = 600_000,  // 10 minutes
  pollIntervalMs = 15_000 // 15 seconds
): Promise<number> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const balance = await getBscUsdcBalance();
    if (balance >= targetAmount) {
      console.log(`[Bridge] BSC USDC arrived: $${balance.toFixed(2)} (target: $${targetAmount})`);
      return balance;
    }

    const remaining = Math.ceil((deadline - Date.now()) / 1000);
    console.log(`[Bridge] Waiting for BSC funds: $${balance.toFixed(2)} / $${targetAmount} (${remaining}s left)...`);
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  throw new Error(`Timed out waiting for $${targetAmount} USDC on BSC after bridge`);
}

// ─── Orchestrator: ensure BSC has enough USDC ──────────────────────

/**
 * Full pipeline: HL → Arbitrum → cBridge → BSC.
 * Checks each layer's balance and only does what's needed.
 */
export async function ensureBscFunds(amountUsd: number): Promise<void> {
  // 1. Already have enough on BSC?
  const bscBalance = await getBscUsdcBalance();
  if (bscBalance >= amountUsd) {
    console.log(`[Bridge] BSC already has $${bscBalance.toFixed(2)} (need $${amountUsd})`);
    return;
  }

  // Add buffer for bridge fees (~0.5% + $0.50 safety margin)
  const bridgeAmount = amountUsd * 1.01 + 0.5;

  // 2. Ensure Arbitrum has enough
  const arbBalance = await getArbitrumUsdcBalance();
  if (arbBalance < bridgeAmount) {
    const deficit = bridgeAmount - arbBalance + 1; // +$1 buffer for HL
    console.log(`[Bridge] Arbitrum has $${arbBalance.toFixed(2)}, need $${bridgeAmount.toFixed(2)} — withdrawing $${deficit.toFixed(2)} from HL`);
    await withdrawFromHyperliquid(deficit);
    await waitForArbitrumFunds(bridgeAmount);
  }

  // 3. Bridge Arbitrum → BSC
  await bridgeUsdcToBsc(bridgeAmount);

  // 4. Wait for BSC delivery
  await waitForBscFunds(amountUsd);
}
