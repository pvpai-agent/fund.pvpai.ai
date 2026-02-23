import { verifyOnChainPayment } from '@/lib/web3/payment';
import { METABOLISM, AGENT_TIERS } from '@/constants/trading';
import type { AgentTier } from '@/constants/trading';
import { findOrCreateUser, updateUserBalance, getUserByWallet } from './user.service';
import { recordTransaction, getTransactionByTxHash } from './ledger.service';
import { createAgent } from './agent.service';
import { calculatePvpFromUsd, getTierBurnRate, rechargeAgent } from './metabolism.service';
import type { ParsedRules } from '@/types/database';

export async function processAgentMint(
  walletAddress: string,
  txHash: string,
  mintAmount: number,
  agentInput: { name: string; prompt: string; parsedRules: ParsedRules; avatarSeed: string; cloneParentId?: string }
): Promise<{ success: boolean; agentId?: string; error?: string }> {
  const existingTx = await getTransactionByTxHash(txHash);
  if (existingTx) return { success: false, error: 'Transaction already processed' };

  // Verify on-chain AND validate sender matches the authenticated wallet
  const verification = await verifyOnChainPayment(txHash, mintAmount, walletAddress);
  if (!verification.verified) return { success: false, error: 'Payment verification failed' };

  const { user } = await findOrCreateUser(walletAddress);

  const capitalUsd = verification.amount * (METABOLISM.CAPITAL_SPLIT_PCT / 100);
  const energyUsd = verification.amount * (METABOLISM.ENERGY_SPLIT_PCT / 100);
  const pvpPoints = calculatePvpFromUsd(energyUsd);
  const tier: AgentTier = (agentInput.parsedRules.tier as AgentTier) ?? METABOLISM.DEFAULT_TIER;
  const burnRate = getTierBurnRate(tier);

  const agent = await createAgent({
    userId: user.id,
    name: agentInput.name,
    prompt: agentInput.prompt,
    parsedRules: agentInput.parsedRules,
    avatarSeed: agentInput.avatarSeed,
    allocatedFunds: capitalUsd,
    energyBalance: pvpPoints,
    capitalBalance: capitalUsd,
    burnRatePerHour: burnRate,
    cloneParentId: agentInput.cloneParentId,
  });

  await recordTransaction({
    userId: user.id,
    agentId: agent.id,
    type: 'agent_mint',
    amount: verification.amount,
    token: 'USDC',
    chain: 'bsc',
    txHash,
    description: `Agent minted: $${capitalUsd.toFixed(2)} capital + $${(pvpPoints / 100).toFixed(2)} fuel (${AGENT_TIERS[tier].name})`,
  });

  return { success: true, agentId: agent.id };
}

export async function processRecharge(
  walletAddress: string,
  txHash: string,
  amount: number,
  agentId: string
): Promise<{ success: boolean; pvpAdded?: number; newBalance?: number; error?: string }> {
  const existingTx = await getTransactionByTxHash(txHash);
  if (existingTx) return { success: false, error: 'Transaction already processed' };

  const verification = await verifyOnChainPayment(txHash, amount, walletAddress);
  if (!verification.verified) return { success: false, error: 'Payment verification failed' };

  const user = await getUserByWallet(walletAddress);
  if (!user) return { success: false, error: 'User not found' };

  const pvpAdded = calculatePvpFromUsd(verification.amount);

  const { agent } = await rechargeAgent(agentId, pvpAdded);

  await recordTransaction({
    userId: user.id,
    agentId,
    type: 'energy_purchase',
    amount: verification.amount,
    token: 'USDC',
    chain: 'bsc',
    txHash,
    description: `Recharge: $${verification.amount.toFixed(2)} → +$${(pvpAdded / 100).toFixed(2)} fuel`,
  });

  return { success: true, pvpAdded, newBalance: Number(agent.energy_balance) };
}

export async function processDeposit(
  walletAddress: string,
  txHash: string,
  expectedAmount: number
): Promise<{ success: boolean; balance?: number; error?: string }> {
  const existingTx = await getTransactionByTxHash(txHash);
  if (existingTx) return { success: false, error: 'Transaction already processed' };

  const verification = await verifyOnChainPayment(txHash, expectedAmount, walletAddress);
  if (!verification.verified) return { success: false, error: 'Deposit verification failed' };

  const user = await getUserByWallet(walletAddress);
  if (!user) return { success: false, error: 'User not found' };

  const balanceBefore = Number(user.balance_usdt);
  const updatedUser = await updateUserBalance(user.id, verification.amount);

  await recordTransaction({
    userId: user.id,
    type: 'deposit',
    amount: verification.amount,
    token: 'USDC',
    chain: 'bsc',
    txHash,
    description: `Deposit: $${verification.amount}`,
    balanceBefore,
    balanceAfter: Number(updatedUser.balance_usdt),
  });

  return { success: true, balance: Number(updatedUser.balance_usdt) };
}
