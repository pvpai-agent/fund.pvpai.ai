'use client';

import { useState } from 'react';
import { useWriteContract, useSwitchChain, useAccount } from 'wagmi';
import { getTransferParams } from '@/lib/web3/contracts';
import type { ParsedRules } from '@/types/database';

export function usePayment() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { chainId: currentChainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();

  const sendPayment = async (chainId: number, amount: number) => {
    setIsPending(true);
    setError(null);
    try {
      if (currentChainId !== chainId) {
        try {
          await switchChainAsync({ chainId });
        } catch {
          setError('Please switch your wallet to BNB Chain (BSC) to continue');
          return null;
        }
      }

      const params = getTransferParams(chainId, amount);
      const txHash = await writeContractAsync({
        ...params,
        chainId,
      });
      return txHash;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment failed';
      if (message.includes('user rejected') || message.includes('User denied') || message.includes('rejected')) {
        setError('Transaction rejected by user');
      } else if (message.includes('insufficient') || message.includes('exceeds balance')) {
        setError('Insufficient USDC balance on BNB Chain');
      } else {
        setError(message);
      }
      return null;
    } finally {
      setIsPending(false);
    }
  };

  // walletAddress no longer sent in body — session cookie provides identity
  const verifyAgentMint = async (
    txHash: string,
    mintAmount: number,
    agentInput: { name: string; prompt: string; parsedRules: ParsedRules; avatarSeed: string; cloneParentId?: string }
  ) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash, mintAmount, agentInput }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return await res.json();
    } catch {
      return { success: false, error: 'Verification timed out — your payment is safe, please try refreshing.' };
    }
  };

  const verifyRecharge = async (
    txHash: string,
    amount: number,
    agentId: string
  ) => {
    try {
      const res = await fetch(`/api/agent/${agentId}/recharge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash, amount }),
      });
      return await res.json();
    } catch {
      return { success: false };
    }
  };

  return { sendPayment, verifyAgentMint, verifyRecharge, isPending, error };
}
