'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useConfetti } from '@/hooks/useConfetti';
import { useT } from '@/hooks/useTranslation';
import type { Agent, Investment } from '@/types/database';

const WITHDRAW_STEPS = [
  '检查钱包余额...',
  '准备 USDC 转账...',
  '正在从 Hyperliquid 提现...',
  '跨链转账中，请耐心等待...',
  '等待链上确认...',
  '即将完成...',
];

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  investment: Investment;
  agent: Agent;
  onWithdraw: (investmentId: string) => Promise<{ txHash?: string; chain?: string; netAmount?: number; feeAmount?: number }>;
}

export function WithdrawModal({ isOpen, onClose, investment, agent, onWithdraw }: WithdrawModalProps) {
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');
  const [txHash, setTxHash] = useState('');
  const [step, setStep] = useState(0);
  const t = useT();
  const { fireGoldConfetti } = useConfetti();

  useEffect(() => {
    if (status !== 'processing') { setStep(0); return; }
    const timer = setInterval(() => {
      setStep((s) => Math.min(s + 1, WITHDRAW_STEPS.length - 1));
    }, 5000);
    return () => clearInterval(timer);
  }, [status]);

  const currentValue = (investment.share_pct / 100) * agent.capital_balance;
  const feeAmount = currentValue * 0.05;
  const netAmount = currentValue - feeAmount;
  const pnl = netAmount - investment.amount;
  const pnlSign = pnl >= 0 ? '+' : '';

  const handleWithdraw = async () => {
    setError('');
    setStep(0);
    setStatus('processing');
    try {
      const result = await onWithdraw(investment.id);
      setTxHash(result?.txHash ?? '');
      setStatus('success');
      fireGoldConfetti();
      setTimeout(() => {
        onClose();
        setStatus('idle');
        setTxHash('');
      }, 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Withdrawal failed');
      setStatus('error');
    }
  };

  const handleClose = () => {
    onClose();
    setStatus('idle');
    setError('');
    setTxHash('');
    setStep(0);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t.withdrawModal.title}>
      <div className="space-y-4">
        {status === 'success' ? (
          <div className="text-center py-6">
            <p className="text-2xl mb-2">💰</p>
            <p className="text-cyber-green font-mono font-bold">Withdrawal Complete!</p>
            <p className="text-xs font-mono text-gray-400 mt-1">
              ${netAmount.toFixed(2)} USDC → Wallet (BSC)
            </p>
            {txHash && (
              <a
                href={`https://bscscan.com/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 text-[10px] font-mono text-cyber-blue hover:underline"
              >
                View on BscScan →
              </a>
            )}
          </div>
        ) : (
          <>
            <div className="font-mono text-xs text-gray-400">
              {t.withdrawModal.withdrawingFrom} <span className="text-cyber-green">{agent.name}</span>{t.withdrawModal.shadowPool}
            </div>

            <div className="bg-cyber-darker rounded border border-terminal-border p-3 space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-gray-500">{t.withdrawModal.originalInvestment}</span>
                <span className="text-gray-300">${investment.amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs font-mono">
                <span className="text-gray-500">{t.withdrawModal.yourShare}</span>
                <span className="text-cyber-gold">{investment.share_pct.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between text-xs font-mono">
                <span className="text-gray-500">{t.withdrawModal.currentValue}</span>
                <span className="text-gray-300">${currentValue.toFixed(2)}</span>
              </div>
              <div className="border-t border-terminal-border my-1" />
              <div className="flex justify-between text-xs font-mono">
                <span className="text-cyber-red">{t.withdrawModal.rageQuitFee}</span>
                <span className="text-cyber-red">-${feeAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs font-mono font-bold">
                <span className="text-gray-300">{t.withdrawModal.netWithdrawal}</span>
                <span className="text-cyber-green">${netAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs font-mono">
                <span className="text-gray-500">{t.withdrawModal.pnl}</span>
                <span className={pnl >= 0 ? 'text-cyber-green' : 'text-cyber-red'}>
                  {pnlSign}${pnl.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="text-[10px] font-mono text-gray-600">
              {t.withdrawModal.feeNote}
            </div>

            {/* Progress steps during processing */}
            {status === 'processing' && (
              <div className="bg-terminal-bg rounded p-3">
                <div className="flex items-center gap-2 text-xs font-mono text-cyber-blue">
                  <span className="w-3 h-3 border-2 border-cyber-blue border-t-transparent rounded-full animate-spin shrink-0" />
                  <span>{WITHDRAW_STEPS[step]}</span>
                </div>
                <div className="flex gap-1 mt-2">
                  {WITHDRAW_STEPS.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                        i <= step ? 'bg-cyber-blue' : 'bg-gray-700'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="text-xs font-mono text-cyber-red">! {error}</div>
            )}

            <Button
              variant="danger"
              size="md"
              className="w-full"
              onClick={handleWithdraw}
              loading={status === 'processing'}
              disabled={status !== 'idle' && status !== 'error'}
            >
              {status === 'processing'
                ? WITHDRAW_STEPS[step]
                : `${t.withdrawModal.withdrawBtn} $${netAmount.toFixed(2)} USDC`}
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
