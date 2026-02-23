'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useT } from '@/hooks/useTranslation';
import { usePayment } from '@/hooks/usePayment';
import { useUsdcBalance } from '@/hooks/useUsdcBalance';
import { useConfetti } from '@/hooks/useConfetti';
import { formatUsd } from '@/lib/utils/format';
import type { Agent } from '@/types/database';

interface InvestModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent: Agent;
  onSuccess: () => void;
}

export function InvestModal({ isOpen, onClose, agent, onSuccess }: InvestModalProps) {
  const [amount, setAmount] = useState(50);
  const [status, setStatus] = useState<'idle' | 'paying' | 'verifying' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');
  const t = useT();
  const { chainId: currentChainId } = useAccount();
  const { sendPayment } = usePayment();
  const { balance: usdcBalance, isLoading: balanceLoading, refetch: refetchBalance } = useUsdcBalance();
  const { fireGoldConfetti } = useConfetti();

  const minInvestment = 10;
  const maxInvestment = Math.max(minInvestment, Math.min(usdcBalance, 10000));
  const effectiveAmount = Math.max(minInvestment, Math.min(amount, maxInvestment));
  const newPool = agent.capital_balance + effectiveAmount;
  const sharePct = newPool > 0 ? (effectiveAmount / newPool) * 100 : 0;
  const hasBalance = usdcBalance >= minInvestment;

  const handleInvest = async () => {
    if (effectiveAmount < minInvestment || !hasBalance) return;
    setStatus('paying');
    setError('');

    try {
      const txHash = await sendPayment(56, effectiveAmount);
      if (!txHash) {
        setError(t.recharge.txFailed);
        setStatus('error');
        return;
      }

      setStatus('verifying');
      await new Promise((r) => setTimeout(r, 5000));

      const res = await fetch(`/api/agent/${agent.id}/invest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash, amount: effectiveAmount }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Investment verification failed');
        setStatus('error');
        return;
      }

      setStatus('success');
      fireGoldConfetti();
      refetchBalance();
      onSuccess();
      setTimeout(() => {
        onClose();
        setStatus('idle');
      }, 2000);
    } catch {
      setError('Network error');
      setStatus('error');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.investModal.title}>
      <div className="space-y-4">
        <div className="font-mono text-xs text-gray-400">
          {t.investModal.investingInto} <span className="text-cyber-green">{agent.name}</span>{t.investModal.shadowPool}
        </div>

        {/* Wallet USDC Balance */}
        <div className="flex items-center justify-between pb-3 border-b border-terminal-border">
          <div>
            <p className="text-[10px] font-mono text-gray-600 uppercase">{t.recharge.usdcOnBsc}</p>
            <p className="text-sm font-bold text-cyber-gold font-mono">
              {balanceLoading ? '...' : formatUsd(usdcBalance)}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${currentChainId === 56 ? 'bg-cyber-green' : 'bg-cyber-red animate-pulse'}`} />
            <span className={`text-[9px] font-mono ${currentChainId === 56 ? 'text-cyber-green' : 'text-cyber-red'}`}>
              {currentChainId === 56 ? 'BSC' : t.common.wrongChain}
            </span>
          </div>
        </div>

        {status === 'success' ? (
          <div className="text-center py-6">
            <p className="text-2xl mb-2">🎉</p>
            <p className="text-cyber-green font-mono font-bold">Investment Complete!</p>
            <p className="text-xs font-mono text-gray-500 mt-1">${effectiveAmount.toFixed(2)} → {sharePct.toFixed(2)}% share</p>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-[10px] font-mono text-gray-500 uppercase mb-1">
                {t.investModal.amountUsdc}
              </label>
              {!hasBalance && !balanceLoading ? (
                <div className="bg-cyber-darker border border-cyber-red/30 rounded px-3 py-4 text-center">
                  <p className="text-xs font-mono text-cyber-red">{t.common.insufficientBalance}</p>
                  <p className="text-[10px] font-mono text-gray-600 mt-1">{t.recharge.usdcOnBsc}: {formatUsd(usdcBalance)}</p>
                </div>
              ) : (
                <>
                  <input
                    type="number"
                    min={minInvestment}
                    max={maxInvestment}
                    value={effectiveAmount}
                    onChange={(e) => setAmount(Math.max(minInvestment, Math.min(maxInvestment, Number(e.target.value))))}
                    className="w-full bg-cyber-darker border border-terminal-border rounded px-3 py-2 font-mono text-sm text-gray-200 focus:border-cyber-green/50 outline-none"
                    disabled={status !== 'idle' && status !== 'error'}
                  />
                  <input
                    type="range"
                    min={minInvestment}
                    max={maxInvestment}
                    step={1}
                    value={effectiveAmount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    disabled={status !== 'idle' && status !== 'error'}
                    className="w-full mt-2 h-2 rounded-lg cursor-pointer appearance-none bg-gray-700 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyber-green [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(0,255,65,0.4)]"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-gray-600 mt-1">
                    <span>${minInvestment}</span>
                    <span className="text-cyber-gold font-bold">${effectiveAmount}</span>
                    <span>${maxInvestment.toFixed(0)}</span>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-2">
              {[10, 50, 100, 500].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setAmount(amt)}
                  disabled={status !== 'idle' && status !== 'error'}
                  className={`flex-1 py-1.5 text-xs font-mono border rounded transition-colors ${
                    effectiveAmount === amt
                      ? 'border-cyber-green text-cyber-green bg-cyber-green/10'
                      : 'border-terminal-border text-gray-500 hover:text-cyber-green hover:border-cyber-green/30'
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>

            <div className="bg-cyber-darker rounded border border-terminal-border p-3 space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-gray-500">{t.investModal.currentPool}</span>
                <span className="text-gray-300">${agent.capital_balance.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs font-mono">
                <span className="text-gray-500">{t.investModal.yourInvestment}</span>
                <span className="text-cyber-green">${effectiveAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs font-mono">
                <span className="text-gray-500">{t.investModal.yourShare}</span>
                <span className="text-cyber-gold">{sharePct.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between text-xs font-mono">
                <span className="text-gray-500">{t.investModal.newPoolTotal}</span>
                <span className="text-gray-300">${newPool.toFixed(2)}</span>
              </div>
            </div>

            <div className="text-[10px] font-mono text-gray-600">
              {t.investModal.rageQuitNote}
            </div>

            {error && <p className="text-cyber-red font-mono text-xs">! {error}</p>}

            {!balanceLoading && effectiveAmount > usdcBalance && hasBalance && (
              <p className="text-cyber-gold font-mono text-[10px]">
                {t.recharge.walletHas} {formatUsd(usdcBalance)} USDC — {t.recharge.need} {formatUsd(effectiveAmount)}
              </p>
            )}

            <Button
              variant="primary"
              size="md"
              className="w-full"
              onClick={handleInvest}
              loading={status === 'paying' || status === 'verifying'}
              disabled={!hasBalance || (status !== 'idle' && status !== 'error')}
            >
              {status === 'paying' ? t.recharge.sendingUsdc :
               status === 'verifying' ? t.recharge.verifying :
               `${t.investModal.investBtn} — ${formatUsd(effectiveAmount)}`}
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
