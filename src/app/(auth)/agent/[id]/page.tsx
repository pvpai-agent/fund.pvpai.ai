'use client';

import { use, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAccount } from 'wagmi';
import { useAgent } from '@/hooks/useAgent';
import { usePayment } from '@/hooks/usePayment';
import { useUsdcBalance } from '@/hooks/useUsdcBalance';
import { useTerminal } from '@/hooks/useTerminal';
import { useConfetti } from '@/hooks/useConfetti';
import { formatUsd, formatPnl, formatFuel, estimateLifespan } from '@/lib/utils/format';
import { METABOLISM, AGENT_TIERS } from '@/constants/trading';
import type { AgentTier } from '@/constants/trading';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { Toast } from '@/components/ui/Toast';
import { TerminalText } from '@/components/effects/TerminalText';
import { GlitchText } from '@/components/effects/GlitchText';
import { MosaicOverlay } from '@/components/effects/MosaicOverlay';
import { NeonBorder } from '@/components/effects/NeonBorder';
import { InvestModal } from '@/components/agent/InvestModal';
import { WithdrawModal } from '@/components/agent/WithdrawModal';
import { AgentChat } from '@/components/agent/AgentChat';
import { UpgradeModal } from '@/components/agent/UpgradeModal';
import { useInvestments } from '@/hooks/useInvestments';
import { useUser } from '@/hooks/useUser';
import { canUpgrade } from '@/constants/upgrades';
import { useT } from '@/hooks/useTranslation';

export default function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { address, chainId: currentChainId } = useAccount();
  const { agent, trades, energyData, isLoading, refetchAgent } = useAgent(id);
  const { sendPayment, verifyRecharge } = usePayment();
  const { balance: usdcBalance, isLoading: balanceLoading, refetch: refetchBalance } = useUsdcBalance();
  const { logs } = useTerminal({
    agentId: id,
    enabled: !isLoading && agent?.status === 'active',
    trades,
  });
  const { fireGoldConfetti } = useConfetti();

  const [showEnergyLog, setShowEnergyLog] = useState(false);
  const [showRecharge, setShowRecharge] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState(20);
  const [rechargeStatus, setRechargeStatus] = useState<'idle' | 'paying' | 'verifying' | 'success' | 'error'>('idle');
  const [rechargeError, setRechargeError] = useState('');
  const [expandedTrade, setExpandedTrade] = useState<string | null>(null);
  const [showSosModal, setShowSosModal] = useState(false);
  const [showInvestModal, setShowInvestModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [terminalTab, setTerminalTab] = useState<'terminal' | 'chat'>('terminal');
  const [claimToast, setClaimToast] = useState('');
  const [cloneToast, setCloneToast] = useState('');
  const [showCreatorWithdraw, setShowCreatorWithdraw] = useState(false);
  const [creatorWithdrawAmount, setCreatorWithdrawAmount] = useState(0);
  const [creatorWithdrawStatus, setCreatorWithdrawStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [creatorWithdrawError, setCreatorWithdrawError] = useState('');
  const [creatorWithdrawTxHash, setCreatorWithdrawTxHash] = useState('');
  const [creatorWithdrawStep, setCreatorWithdrawStep] = useState(0);
  const [claimLoading, setClaimLoading] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState(false);
  const [editDirection, setEditDirection] = useState<'long' | 'short' | 'both'>('both');
  const [editKeywords, setEditKeywords] = useState('');
  const [editLeverage, setEditLeverage] = useState(5);
  const [editStopLoss, setEditStopLoss] = useState(5);
  const [editTakeProfit, setEditTakeProfit] = useState(10);
  const [savingStrategy, setSavingStrategy] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [promoteHours, setPromoteHours] = useState(1);
  const [promoteSlot, setPromoteSlot] = useState<1 | 2>(1);
  const [promoteStartOffset, setPromoteStartOffset] = useState(0); // hours from now
  const [promoteStatus, setPromoteStatus] = useState<'idle' | 'paying' | 'success' | 'error'>('idle');

  // Progress messages for long-running withdrawal (HL → Arbitrum can take 1-5 min)
  const withdrawSteps = [
    '检查钱包余额...',
    '准备 USDC 转账...',
    '正在从 Hyperliquid 提现...',
    '跨链转账中，请耐心等待...',
    '等待链上确认...',
    '即将完成...',
  ];
  useEffect(() => {
    if (creatorWithdrawStatus !== 'processing') {
      setCreatorWithdrawStep(0);
      return;
    }
    const timer = setInterval(() => {
      setCreatorWithdrawStep((s) => Math.min(s + 1, withdrawSteps.length - 1));
    }, 5000);
    return () => clearInterval(timer);
  }, [creatorWithdrawStatus, withdrawSteps.length]);

  const { user } = useUser();
  const t = useT();
  const { investments, withdraw } = useInvestments();
  const isCreator = !!(user && agent && user.id === agent.user_id);
  // Find user's active investment in THIS agent
  const myInvestment = investments.find(
    (inv) => inv.agent_id === id && inv.status === 'active'
  );

  const startEditStrategy = () => {
    if (!agent) return;
    setEditDirection(agent.parsed_rules.direction_bias);
    setEditKeywords(agent.parsed_rules.keywords.join(', '));
    setEditLeverage(agent.parsed_rules.risk_management.max_leverage);
    setEditStopLoss(agent.parsed_rules.risk_management.stop_loss_pct);
    setEditTakeProfit(agent.parsed_rules.risk_management.take_profit_pct);
    setEditingStrategy(true);
  };

  const saveStrategy = async () => {
    if (!agent) return;
    setSavingStrategy(true);
    try {
      const res = await fetch(`/api/agent/${agent.id}/strategy`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction_bias: editDirection,
          keywords: editKeywords.split(',').map((k) => k.trim()).filter(Boolean),
          risk_management: {
            ...agent.parsed_rules.risk_management,
            max_leverage: editLeverage,
            stop_loss_pct: editStopLoss,
            take_profit_pct: editTakeProfit,
          },
        }),
      });
      const json = await res.json();
      if (json.success) {
        setEditingStrategy(false);
        refetchAgent();
        setClaimToast(t.agent.strategyUpdated);
        setTimeout(() => setClaimToast(''), 2500);
      }
    } catch {
      setClaimToast(t.agent.strategyFailed);
      setTimeout(() => setClaimToast(''), 2500);
    } finally {
      setSavingStrategy(false);
    }
  };

  const isDead = agent?.status === 'dead';
  const energy = Number(agent?.energy_balance ?? 0);
  const capital = Number(agent?.capital_balance ?? 0);
  const burnRate = Number(agent?.burn_rate_per_hour ?? 0);

  // Role-aware position display
  const isInvestor = !!myInvestment;
  const displayCapital = isCreator
    ? capital
    : isInvestor
      ? (myInvestment.share_pct / 100) * capital
      : 0;
  const displayClaimable = isCreator
    ? Number(agent?.creator_earnings ?? 0)
    : isInvestor
      ? Math.max(0, (myInvestment.share_pct / 100) * capital - myInvestment.amount)
      : 0;
  const totalPosition = displayCapital + displayClaimable;
  const lifeHours = isDead ? 0 : estimateLifespan(energy, burnRate);
  const lifeDays = lifeHours / 24;
  const energyPct = isDead ? 0 : Math.min(100, (energy / 10000) * 100);
  const isCritical = !isDead && lifeHours < 24;

  const agentTier = (agent?.parsed_rules?.tier as AgentTier) ?? 'sniper';
  const tierConfig = AGENT_TIERS[agentTier];

  // Recharge preview
  const rechargePvp = rechargeAmount * METABOLISM.PVP_PER_USD;
  const rechargeDaysAdded = tierConfig ? rechargePvp / tierConfig.pvp_per_day : 0;

  const handleRecharge = async () => {
    if (!address || !agent) return;
    setRechargeStatus('paying');
    setRechargeError('');

    try {
      const txHash = await sendPayment(56, rechargeAmount);
      if (!txHash) {
        setRechargeError(t.recharge.txFailed);
        setRechargeStatus('error');
        return;
      }

      setRechargeStatus('verifying');
      await new Promise((r) => setTimeout(r, 5000));

      const result = await verifyRecharge(txHash, rechargeAmount, agent.id);
      if (!result.success) {
        setRechargeError(result.error || t.recharge.verifyFailed);
        setRechargeStatus('error');
        return;
      }

      setRechargeStatus('success');
      fireGoldConfetti();
      refetchAgent();
      refetchBalance();
      setTimeout(() => {
        setShowRecharge(false);
        setRechargeStatus('idle');
      }, 2000);
    } catch {
      setRechargeError(t.recharge.networkError);
      setRechargeStatus('error');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 font-mono">{t.common.agentNotFound}</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col lg:flex-row gap-6 ${isDead ? 'relative' : ''}`}>
      {/* K.I.A. Overlay for Dead Agents */}
      {isDead && (
        <div className="absolute inset-0 z-10 flex items-start justify-center pt-20 pointer-events-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="pointer-events-auto text-center"
          >
            <GlitchText text={t.agent.kiaTitle} className="text-6xl font-bold text-red-500" />
            <p className="text-gray-500 font-mono text-sm mt-2">
              {t.agent.kiaSubtitle}
              {agent.died_at && ` ${t.agent.died} ${new Date(agent.died_at).toLocaleDateString()}`}
            </p>
          </motion.div>
        </div>
      )}

      {/* ════════ LEFT COLUMN ════════ */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Agent Header */}
        <div className={`flex items-start justify-between ${isDead ? 'opacity-40 grayscale' : ''}`}>
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-lg border flex items-center justify-center text-2xl ${
              isDead ? 'border-gray-600 bg-gray-800' : 'border-cyber-green/30 bg-cyber-green/5'
            }`}>
              {isDead ? '💀' : tierConfig?.icon ?? '🤖'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-mono font-bold text-cyber-green uppercase tracking-wider">
                  {agent.name}
                </h1>
                {/* Token ticker */}
                <span className="text-sm font-mono text-gray-500">
                  ${agent.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase()}
                </span>
              </div>
              <p className="text-xs font-mono text-gray-500 mt-0.5">
                {tierConfig?.name ?? 'Agent'} — {agent.parsed_rules.description}
              </p>
              {/* Clickable wallet address → BscScan */}
              <a
                href={`https://bscscan.com/address/${agent.ai_wallet ?? '0x'}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] font-mono text-cyber-blue/60 mt-0.5 hover:text-cyber-blue transition-colors"
              >
                {agent.ai_wallet ? `${agent.ai_wallet.slice(0, 6)}...${agent.ai_wallet.slice(-4)}` : '0x...'}
                <span className="text-[8px]">↗</span>
                <span className="text-gray-700 ml-1">BNB Chain</span>
              </a>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isDead && (
              <button
                onClick={() => {
                  const pnl = formatPnl(Number(agent.total_pnl));
                  const text = `My AI agent "${agent.name}" is ${Number(agent.total_pnl) >= 0 ? 'up' : 'down'} ${pnl} on @pvp_ai!\n\nDeploy your own autonomous trading agent:`;
                  const url = `${window.location.origin}/agent/${agent.id}`;
                  window.open(
                    `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
                    '_blank'
                  );
                }}
                className="px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-wider rounded transition-all border border-gray-500 text-gray-300 hover:border-gray-200 hover:text-gray-200 hover:bg-gray-200/5"
              >
                {t.common.share}
              </button>
            )}
            <Badge
              variant={
                agent.status === 'active' ? 'green' :
                agent.status === 'paused' ? 'gold' :
                isDead ? 'red' : 'gray'
              }
              pulse={agent.status === 'active'}
            >
              {isDead ? 'K.I.A.' : agent.status}
            </Badge>
          </div>
        </div>

        {/* Agent Details — Folded Accordion */}
        <details className={`group ${isDead ? 'opacity-40 grayscale' : ''}`} open>
          <summary className="text-sm font-mono text-gray-400 uppercase tracking-wider cursor-pointer hover:text-cyber-green transition-colors select-none list-none">
            <span className="text-cyber-green/60">{'// '}</span>
            <span className="group-open:hidden">[+]</span>
            <span className="hidden group-open:inline">[-]</span>
            {' '}{t.agent.viewStrategy}
          </summary>
          <div className="relative mt-2">
            <Card>
              {editingStrategy ? (
                /* ── Chat-style Strategy Editor (creator only) ── */
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-gray-600 uppercase">{t.agent.editStrategy}</span>
                    <button
                      onClick={() => setEditingStrategy(false)}
                      className="text-[9px] font-mono text-gray-500 hover:text-gray-300"
                    >
                      [X]
                    </button>
                  </div>

                  {/* Current strategy summary */}
                  <div className="bg-terminal-bg rounded p-2 text-[10px] font-mono text-gray-500">
                    {t.agent.direction} <span className="text-cyber-blue">{agent.parsed_rules.direction_bias}</span>
                    {' | '}{t.agent.leverage} <span className="text-cyber-gold">{agent.parsed_rules.risk_management.max_leverage}x</span>
                    {' | '}{t.agent.stopLoss} <span className="text-cyber-red">{agent.parsed_rules.risk_management.stop_loss_pct}%</span>
                    {' | '}{t.agent.takeProfit} <span className="text-cyber-green">{agent.parsed_rules.risk_management.take_profit_pct}%</span>
                  </div>

                  {/* AI welcome message */}
                  <div className="bg-cyber-darker border border-terminal-border rounded-lg p-3 text-xs font-mono text-gray-300">
                    <span className="text-cyber-green text-[10px]">AI {'>'}</span>{' '}
                    {t.agent.chatEditWelcome}
                  </div>

                  {/* Editable parameter preview */}
                  <div className="bg-cyber-darker border border-cyber-blue/20 rounded-lg p-3 space-y-2 text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 w-16">{t.agent.direction}</span>
                      <div className="flex gap-1 flex-1">
                        {(['long', 'short', 'both'] as const).map((d) => (
                          <button
                            key={d}
                            onClick={() => setEditDirection(d)}
                            className={`flex-1 py-1 text-[10px] font-mono uppercase rounded border transition-colors ${
                              editDirection === d
                                ? 'border-cyber-blue text-cyber-blue bg-cyber-blue/10'
                                : 'border-terminal-border text-gray-600 hover:border-gray-500'
                            }`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 w-16">{t.agent.keywords}</span>
                      <input
                        value={editKeywords}
                        onChange={(e) => setEditKeywords(e.target.value)}
                        className="flex-1 bg-cyber-darker border border-terminal-border rounded px-2 py-1 font-mono text-xs text-gray-200 focus:border-cyber-blue/50 outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-600 text-[10px]">{t.agent.leverage}</span>
                        <input type="number" min={1} max={50} value={editLeverage} onChange={(e) => setEditLeverage(Number(e.target.value))}
                          className="w-full bg-cyber-darker border border-terminal-border rounded px-2 py-1 font-mono text-xs text-gray-200 focus:border-cyber-blue/50 outline-none" />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-600 text-[10px]">SL%</span>
                        <input type="number" min={1} max={50} value={editStopLoss} onChange={(e) => setEditStopLoss(Number(e.target.value))}
                          className="w-full bg-cyber-darker border border-terminal-border rounded px-2 py-1 font-mono text-xs text-gray-200 focus:border-cyber-blue/50 outline-none" />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-600 text-[10px]">TP%</span>
                        <input type="number" min={1} max={100} value={editTakeProfit} onChange={(e) => setEditTakeProfit(Number(e.target.value))}
                          className="w-full bg-cyber-darker border border-terminal-border rounded px-2 py-1 font-mono text-xs text-gray-200 focus:border-cyber-blue/50 outline-none" />
                      </div>
                    </div>
                  </div>

                  {/* Chat input + save */}
                  <div className="flex gap-2">
                    <input
                      placeholder={t.agent.chatEditPlaceholder}
                      className="flex-1 bg-cyber-darker border border-terminal-border rounded px-3 py-2 font-mono text-xs text-gray-200 placeholder:text-gray-600 focus:border-cyber-green/50 outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = (e.target as HTMLInputElement).value.toLowerCase();
                          // Simple keyword-based AI parsing
                          if (val.includes('long') || val.includes('做多') || val.includes('多头')) setEditDirection('long');
                          if (val.includes('short') || val.includes('做空') || val.includes('空头')) setEditDirection('short');
                          if (val.includes('both') || val.includes('双向')) setEditDirection('both');
                          const levMatch = val.match(/(\d+)\s*[xX倍]/);
                          if (levMatch) setEditLeverage(Number(levMatch[1]));
                          const slMatch = val.match(/止损\s*(\d+)|stop.?loss\s*(\d+)|sl\s*(\d+)/i);
                          if (slMatch) setEditStopLoss(Number(slMatch[1] || slMatch[2] || slMatch[3]));
                          const tpMatch = val.match(/止盈\s*(\d+)|take.?profit\s*(\d+)|tp\s*(\d+)/i);
                          if (tpMatch) setEditTakeProfit(Number(tpMatch[1] || tpMatch[2] || tpMatch[3]));
                          (e.target as HTMLInputElement).value = '';
                        }
                      }}
                    />
                    <button
                      onClick={saveStrategy}
                      disabled={savingStrategy}
                      className="px-4 py-2 text-[10px] font-mono font-bold uppercase rounded bg-cyber-green/15 border border-cyber-green/60 text-cyber-green hover:bg-cyber-green/25 transition-all disabled:opacity-30"
                    >
                      {savingStrategy ? t.agent.saving : t.agent.chatEditApply}
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Read-only Strategy View + Clone for non-creators ── */
                <>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-gray-600">{t.agent.direction}</span>{' '}
                        <span className="text-cyber-blue">{agent.parsed_rules.direction_bias}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Creator: Edit Strategy button */}
                        {!isDead && isCreator && (
                          <button
                            onClick={startEditStrategy}
                            className="px-2.5 py-1 text-[8px] font-mono font-bold uppercase tracking-wider rounded bg-cyber-blue/15 border border-cyber-blue/50 text-cyber-blue hover:bg-cyber-blue/25 transition-all"
                          >
                            {t.agent.editStrategy}
                          </button>
                        )}
                        {/* Non-creator: Clone button */}
                        {!isDead && !isCreator && (
                          <button
                            onClick={() => router.push(`/agent/new?clone=${agent.id}`)}
                            className="px-2.5 py-1 text-[8px] font-mono font-bold uppercase tracking-wider rounded transition-all border border-cyber-blue/50 text-cyber-blue hover:bg-cyber-blue/10 shadow-[0_0_8px_rgba(0,200,255,0.2)] hover:shadow-[0_0_16px_rgba(0,200,255,0.4)]"
                          >
                            {t.common.clone}
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">{t.agent.keywords}:</span>{' '}
                      <span className="text-cyber-green">{agent.parsed_rules.keywords.join(', ')}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">{t.agent.leverage}:</span>{' '}
                      <span className="text-cyber-gold">{agent.parsed_rules.risk_management.max_leverage}x</span>
                    </div>
                    <div>
                      <span className="text-gray-600">{t.agent.stopLoss}:</span>{' '}
                      <span className="text-cyber-red">{agent.parsed_rules.risk_management.stop_loss_pct}%</span>
                      <span className="text-gray-700 mx-1.5">|</span>
                      <span className="text-gray-600">{t.agent.takeProfit}:</span>{' '}
                      <span className="text-cyber-green">{agent.parsed_rules.risk_management.take_profit_pct}%</span>
                    </div>
                  </div>
                  {tierConfig && (
                    <div className="mt-3 pt-3 border-t border-terminal-border">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-mono text-gray-600 uppercase">{t.agent.package}</p>
                        {!isDead && isCreator && canUpgrade(agentTier) && (
                          <button
                            onClick={() => setShowUpgradeModal(true)}
                            className="px-2 py-0.5 text-[8px] font-mono font-bold uppercase tracking-wider rounded border border-cyber-gold/50 text-cyber-gold hover:bg-cyber-gold/10 transition-colors animate-pulse"
                          >
                            {t.agent.upgradeTier}
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        <div>
                          <span className="text-gray-600">{t.agent.tier}</span>{' '}
                          <span className="text-cyber-green">{tierConfig.icon} {tierConfig.name}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">{t.agent.ai}</span>{' '}
                          <span className="text-cyber-blue">{tierConfig.ai_label}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">{t.agent.compute}</span>{' '}
                          <span className="text-gray-300">{tierConfig.compute}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">{t.agent.frequency}</span>{' '}
                          <span className="text-gray-300">{tierConfig.frequency_label}</span>
                        </div>
                      </div>
                      <div className="mt-2 text-xs font-mono">
                        <span className="text-gray-600">{t.agent.dataFeeds}</span>{' '}
                        <span className="text-cyber-gold">{tierConfig.data_feeds.join(', ')}</span>
                      </div>
                      <div className="mt-3 pt-3 border-t border-terminal-border">
                        <p className="text-[10px] font-mono text-gray-500">
                          {t.agent.revenueSplit}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </Card>
            <MosaicOverlay isLocked={false} />
          </div>
        </details>

        {/* Full-width Fuel Bar */}
        <Card className={isDead ? 'opacity-40 grayscale' : ''}>
          <div className="flex justify-between items-center text-xs font-mono mb-1">
            <span className="text-gray-500 uppercase">{t.agent.fuel}</span>
            <div className="flex items-center gap-2">
              <span className={isDead ? 'text-gray-600' : isCritical ? 'text-red-500 animate-pulse' : 'text-fuchsia-400'}>
                {isDead ? t.agent.depleted : `${formatFuel(energy)} (~${lifeDays.toFixed(1)}d)`}
              </span>
              {!isDead && (
                <>
                  <button
                    onClick={() => setShowRecharge(true)}
                    className="px-2.5 py-1 text-[8px] font-mono font-bold uppercase tracking-wider rounded bg-cyber-green/20 border border-cyber-green/60 text-cyber-green hover:bg-cyber-green/30 transition-all shadow-[0_0_8px_rgba(0,255,65,0.15)]"
                  >
                    {t.agent.refuel}
                  </button>
                  <button
                    onClick={() => setShowSosModal(true)}
                    className="px-2.5 py-1 text-[8px] font-mono font-bold uppercase tracking-wider rounded bg-cyber-red/20 border border-cyber-red/60 text-cyber-red hover:bg-cyber-red/30 transition-all animate-pulse shadow-[0_0_10px_rgba(255,50,50,0.25)]"
                  >
                    {t.agent.sosBeg}
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="w-full h-3 bg-gray-800 rounded-full">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isDead ? 'bg-gray-600' :
                isCritical ? 'bg-red-500 animate-pulse' :
                'bg-gradient-to-r from-fuchsia-500 to-cyber-green'
              }`}
              style={{ width: `${energyPct}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] font-mono text-gray-600 mt-1">
            <div className="flex items-center gap-2">
              <span>{t.agent.burnPerDay} {formatFuel(burnRate * 24)}{t.agent.perDay}</span>
              {!isDead && isCreator && canUpgrade(agentTier) && (
                <button
                  onClick={() => setShowUpgradeModal(true)}
                  className="px-2.5 py-1 text-[8px] font-mono font-bold uppercase rounded bg-cyber-gold/20 border border-cyber-gold/60 text-cyber-gold hover:bg-cyber-gold/30 transition-all shadow-[0_0_8px_rgba(255,215,0,0.15)]"
                >
                  {t.agent.upgrade}
                </button>
              )}
              {!isDead && (
                <button
                  onClick={() => setShowPromoteModal(true)}
                  className="px-2.5 py-1 text-[8px] font-mono font-bold uppercase rounded bg-cyber-purple/20 border border-cyber-purple/60 text-cyber-purple hover:bg-cyber-purple/30 transition-all shadow-[0_0_8px_rgba(191,0,255,0.15)]"
                >
                  {t.agent.promote}
                </button>
              )}
            </div>
            <span>{isDead ? t.agent.dead : `${energyPct.toFixed(1)}%`}</span>
          </div>
          {energyData && energyData.logs.length > 0 && (
            <>
              <button
                onClick={() => setShowEnergyLog(!showEnergyLog)}
                className="text-[9px] font-mono text-gray-700 hover:text-gray-500 transition-colors mt-1.5"
              >
                {showEnergyLog ? t.agent.hideFuelLog : t.agent.showFuelLog}
              </button>
              {showEnergyLog && (
                <div className="space-y-1 mt-1.5 max-h-40 overflow-y-auto">
                  {energyData.logs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between py-1 px-1.5 rounded bg-gray-800/50 text-[9px] font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className={Number(log.amount) > 0 ? 'text-cyber-green' : 'text-red-500'}>
                          {Number(log.amount) > 0 ? '+' : ''}{formatFuel(Math.abs(Number(log.amount)))}
                        </span>
                        <span className="text-gray-600">{log.reason}</span>
                      </div>
                      <span className="text-gray-700">{new Date(log.created_at).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Card>

        {/* Core Metrics Grid */}
        <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 ${isDead ? 'opacity-40 grayscale' : ''}`}>
          <Card>
            <p className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">{t.agent.totalPnl}</p>
            <p className={`text-lg font-bold font-mono mt-1 ${Number(agent.total_pnl) >= 0 ? 'text-cyber-green' : 'text-cyber-red'}`}>
              {formatPnl(Number(agent.total_pnl))}
            </p>
            <p className="text-[10px] font-mono text-gray-500 mt-0.5">
              {capital > 0 ? `${Number(agent.total_pnl) >= 0 ? '+' : ''}${((Number(agent.total_pnl) / capital) * 100).toFixed(1)}% ${t.agent.returnLabel}` : '—'}
            </p>
          </Card>
          <Card>
            <p className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">{t.agent.winRate}</p>
            <p className="text-lg font-bold font-mono text-cyber-blue mt-1">
              {Number(agent.win_rate).toFixed(0)}%
            </p>
            <p className="text-[10px] font-mono text-gray-500 mt-0.5">
              {agent.total_trades} {t.agent.totalTrades}
            </p>
          </Card>
          <Card>
            <p className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">{t.agent.aumTvl}</p>
            <p className="text-lg font-bold font-mono text-cyber-gold mt-1">
              {formatUsd(capital)}
            </p>
            <p className="text-[10px] font-mono text-gray-500 mt-0.5">
              {t.agent.totalLiquidity}
            </p>
          </Card>
          <Card>
            <p className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">{t.agent.uptime}</p>
            <p className="text-lg font-bold font-mono text-gray-200 mt-1">
              {(() => {
                const ms = Date.now() - new Date(agent.created_at).getTime();
                const d = Math.floor(ms / 86400000);
                const h = Math.floor((ms % 86400000) / 3600000);
                return d > 0 ? `${d}d ${h}h` : `${h}h`;
              })()}
            </p>
            <p className="text-[10px] font-mono text-gray-500 mt-0.5">
              {t.agent.since} {new Date(agent.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </p>
          </Card>
        </div>

        {/* YOUR POSITION — Unified Card */}
        <div className={isDead ? 'opacity-40 grayscale' : ''}>
          <NeonBorder color="purple" animate={false}>
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🏦</span>
                <h3 className="text-sm font-mono text-gray-300 uppercase tracking-wider font-bold">
                  {t.agent.yourPosition}
                </h3>
              </div>

              {/* Big combined total */}
              <p className="text-2xl font-bold font-mono text-gray-200">
                {formatUsd(totalPosition)}
                <span className="text-xs text-gray-500 font-normal ml-2">USDC</span>
              </p>

              {/* Breakdown: capital + claimable with inline claim button */}
              <div className="flex items-center gap-3 mt-2 text-[10px] font-mono text-gray-500">
                <span>{t.agent.capital} <span className="text-cyber-purple">{formatUsd(displayCapital)}</span></span>
                <span className="text-gray-700">|</span>
                <span className="flex items-center gap-1.5">
                  {t.agent.claimableProfit} <span className="text-cyber-green">{formatUsd(displayClaimable)}</span>
                  {!isDead && isCreator && Number(agent.creator_earnings ?? 0) > 0 && (
                    <button
                      onClick={async () => {
                        setClaimLoading(true);
                        try {
                          const res = await fetch(`/api/agent/${agent.id}/claim`, { method: 'POST' });
                          const data = await res.json();
                          if (data.success) {
                            fireGoldConfetti();
                            setClaimToast(`Profits Claimed! +$${data.data.claimed.toFixed(2)} USDC`);
                            refetchAgent();
                          } else {
                            setClaimToast(data.error || 'Claim failed');
                          }
                        } catch {
                          setClaimToast('Claim failed');
                        }
                        setClaimLoading(false);
                        setTimeout(() => setClaimToast(''), 4000);
                      }}
                      disabled={claimLoading}
                      className="px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider rounded border border-cyber-gold/50 text-cyber-gold bg-cyber-gold/10 hover:bg-cyber-gold/20 transition-all disabled:opacity-40"
                    >
                      {claimLoading ? '...' : t.agent.claimProfit}
                    </button>
                  )}
                </span>
              </div>

              {/* Deposit / Withdraw — large buttons */}
              {!isDead && (
                <div className="flex gap-3 mt-5">
                  <button
                    onClick={() => setShowInvestModal(true)}
                    className="flex-1 py-3 text-sm font-mono font-bold uppercase tracking-wider rounded-lg bg-cyber-green/15 border border-cyber-green/60 text-cyber-green hover:bg-cyber-green/25 transition-all shadow-[0_0_12px_rgba(0,255,65,0.2)]"
                  >
                    {t.common.deposit}
                  </button>
                  <button
                    onClick={() => {
                      if (isCreator) {
                        setCreatorWithdrawAmount(Math.min(capital, Math.floor(capital)));
                        setShowCreatorWithdraw(true);
                      } else if (myInvestment) {
                        setShowWithdrawModal(true);
                      } else {
                        setClaimToast(t.agent.noPosition);
                        setTimeout(() => setClaimToast(''), 2500);
                      }
                    }}
                    className="flex-1 py-3 text-sm font-mono font-bold uppercase tracking-wider rounded-lg bg-cyber-red/10 border border-cyber-red/50 text-cyber-red hover:bg-cyber-red/20 transition-all shadow-[0_0_12px_rgba(255,50,50,0.15)]"
                  >
                    {t.common.withdraw}
                  </button>
                </div>
              )}
            </Card>
          </NeonBorder>
        </div>



        {/* Trade History */}
        <div className={isDead ? 'opacity-40 grayscale' : ''}>
          <h3 className="text-sm font-mono text-gray-400 uppercase tracking-wider mb-3">
{t.agent.tradeHistory}
          </h3>
          {trades.length === 0 ? (
            <Card className="text-center py-8">
              <p className="text-gray-600 font-mono text-xs">{t.common.noTradesYet}</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {trades.map((trade) => {
                const triggerData = trade.trigger_data as Record<string, unknown> | null;
                const confidence = triggerData?.confidence as number | undefined;
                const matchedHeadlines = triggerData?.matchedHeadlines as string[] | undefined;
                const isExpanded = expandedTrade === trade.id;

                return (
                  <motion.div
                    key={trade.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <Card
                      className="cursor-pointer hover:border-cyber-green/20 transition-colors"
                      onClick={() => setExpandedTrade(isExpanded ? null : trade.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant={trade.direction === 'long' ? 'green' : 'red'}>
                            {trade.direction}
                          </Badge>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-mono text-gray-300">{trade.symbol}</p>
                              {confidence != null && (
                                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                                  confidence >= 85 ? 'bg-cyber-green/20 text-cyber-green' :
                                  confidence >= 70 ? 'bg-cyber-blue/20 text-cyber-blue' :
                                  'bg-gray-700 text-gray-400'
                                }`}>
                                  AI {confidence}%
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] font-mono text-gray-600 max-w-[300px] truncate">
                              {trade.trigger_reason}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-3">
                          <div>
                            <p className={`text-sm font-mono font-bold ${
                              Number(trade.realized_pnl ?? 0) >= 0 ? 'text-cyber-green' : 'text-cyber-red'
                            }`}>
                              {trade.realized_pnl != null ? formatPnl(Number(trade.realized_pnl)) : '--'}
                            </p>
                            <Badge variant={trade.status === 'open' ? 'blue' : trade.status === 'closed' ? 'gray' : 'red'}>
                              {trade.status}
                            </Badge>
                          </div>
                          <span className="text-gray-600 text-xs">{isExpanded ? '[-]' : '[+]'}</span>
                        </div>
                      </div>

                      {/* Expanded: AI Analysis Details */}
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-3 pt-3 border-t border-terminal-border space-y-2"
                        >
                          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                            <div>
                              <span className="text-gray-600">{t.agent.entry}</span>
                              <p className="text-gray-300">${Number(trade.entry_price ?? 0).toFixed(2)}</p>
                            </div>
                            <div>
                              <span className="text-gray-600">{t.agent.exit}</span>
                              <p className="text-gray-300">{trade.exit_price ? `$${Number(trade.exit_price).toFixed(2)}` : t.agent.open}</p>
                            </div>
                            <div>
                              <span className="text-gray-600">{t.agent.size}</span>
                              <p className="text-gray-300">{Number(trade.size).toFixed(3)} @ {trade.leverage}x</p>
                            </div>
                            <div>
                              <span className="text-gray-600">{t.agent.time}</span>
                              <p className="text-gray-300">{new Date(trade.opened_at).toLocaleString()}</p>
                            </div>
                          </div>

                          {/* AI Reasoning */}
                          {trade.trigger_reason && (
                            <div className="bg-terminal-bg rounded p-2">
                              <p className="text-[9px] font-mono text-cyber-blue uppercase mb-1">{t.agent.aiAnalysis}</p>
                              <p className="text-[11px] font-mono text-gray-300 leading-relaxed">
                                {trade.trigger_reason}
                              </p>
                            </div>
                          )}

                          {/* Matched Headlines */}
                          {matchedHeadlines && matchedHeadlines.length > 0 && (
                            <div className="bg-terminal-bg rounded p-2">
                              <p className="text-[9px] font-mono text-cyber-gold uppercase mb-1">
                                {t.agent.newsTriggers} ({matchedHeadlines.length})
                              </p>
                              {matchedHeadlines.map((h, i) => (
                                <p key={i} className="text-[10px] font-mono text-gray-400 leading-relaxed">
                                  {i + 1}. {h}
                                </p>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>{/* end LEFT COLUMN */}

      {/* ════════ RIGHT COLUMN — Sticky Terminal / Chat ════════ */}
      {!isDead && (
        <div className="hidden lg:block w-[480px] shrink-0">
          <div className="sticky top-8 h-[calc(100vh-4rem)] flex flex-col">
            <NeonBorder color={terminalTab === 'terminal' ? 'green' : 'blue'} className="h-full">
              <Card variant="terminal" className="h-full relative flex flex-col">
                {/* Header */}
                <div className={`flex items-center justify-between mb-2 border-b pb-2 shrink-0 ${terminalTab === 'terminal' ? 'border-cyber-green/20' : 'border-cyber-blue/20'}`}>
                  <span className={`text-[10px] font-mono uppercase tracking-wider ${terminalTab === 'terminal' ? 'text-cyber-green' : 'text-cyber-blue'}`}>
                    {terminalTab === 'terminal' ? t.agent.liveTerminal : t.agent.chat} - {agent.name}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full animate-pulse ${terminalTab === 'terminal' ? 'bg-cyber-green' : 'bg-cyber-blue'}`} />
                    <span className="text-[10px] font-mono text-gray-600">LIVE</span>
                  </div>
                </div>

                {/* Content area */}
                {terminalTab === 'terminal' ? (
                  <>
                    <TerminalText lines={logs} speed={30} className="flex-1 min-h-0" />
                    {/* Terminal bottom bar: tab toggle + placeholder → click switches to chat */}
                    <div className="shrink-0 pt-2 mt-2 border-t border-cyber-green/20">
                      <div className="flex items-center gap-2">
                        <div className="flex shrink-0 rounded overflow-hidden border border-terminal-border">
                          <button className="px-2 py-1.5 text-[9px] font-mono font-bold uppercase tracking-wider bg-cyber-green/20 text-cyber-green">
                            {t.agent.terminal}
                          </button>
                          <button
                            onClick={() => setTerminalTab('chat')}
                            className="px-2 py-1.5 text-[9px] font-mono font-bold uppercase tracking-wider text-gray-600 hover:text-gray-400 transition-colors"
                          >
                            {t.agent.chat}
                          </button>
                        </div>
                        <div
                          className="flex-1 px-2 py-1.5 bg-cyber-darker border border-terminal-border rounded text-[11px] font-mono text-gray-600 cursor-text"
                          onClick={() => setTerminalTab('chat')}
                        >
                          {t.agent.askAbout}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Chat mode: AgentChat with tab toggle injected into its input bar */
                  <AgentChat
                    agentId={id}
                    tabSlot={
                      <div className="flex shrink-0 rounded overflow-hidden border border-terminal-border">
                        <button
                          onClick={() => setTerminalTab('terminal')}
                          className="px-2 py-1.5 text-[9px] font-mono font-bold uppercase tracking-wider text-gray-600 hover:text-gray-400 transition-colors"
                        >
                          {t.agent.terminal}
                        </button>
                        <button className="px-2 py-1.5 text-[9px] font-mono font-bold uppercase tracking-wider bg-cyber-blue/20 text-cyber-blue">
                          {t.agent.chat}
                        </button>
                      </div>
                    }
                  />
                )}
              </Card>
            </NeonBorder>
          </div>
        </div>
      )}

      {/* ───── Recharge Modal ───── */}
      {showRecharge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-cyber-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md mx-4"
          >
            <NeonBorder color="green">
              <Card className="relative">
                <button
                  onClick={() => { setShowRecharge(false); setRechargeStatus('idle'); setRechargeError(''); }}
                  className="absolute top-3 right-3 text-gray-500 hover:text-gray-300 font-mono"
                >
                  [X]
                </button>

                <h3 className="text-sm font-mono font-bold text-cyber-green uppercase tracking-wider mb-3">
                  {t.recharge.title}
                </h3>

                {/* Wallet USDC Balance */}
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-terminal-border">
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

                {rechargeStatus === 'success' ? (
                  <div className="text-center py-6">
                    <p className="text-2xl mb-2">⚡</p>
                    <p className="text-cyber-green font-mono font-bold">{t.recharge.rechargeComplete}</p>
                    <p className="text-xs font-mono text-gray-500 mt-1">+{formatFuel(rechargePvp)} {t.recharge.fuelAdded}</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-mono text-gray-600 uppercase block mb-1">{t.recharge.amountUsdc}</label>
                        <input
                          type="range"
                          min={METABOLISM.MIN_RECHARGE_USD}
                          max={500}
                          step={10}
                          value={rechargeAmount}
                          onChange={(e) => setRechargeAmount(Number(e.target.value))}
                          className="w-full h-2 rounded-lg cursor-pointer appearance-none bg-gray-700 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyber-green [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(0,255,65,0.4)]"
                          disabled={rechargeStatus !== 'idle'}
                        />
                        <div className="flex justify-between text-xs font-mono text-gray-500 mt-1">
                          <span>${METABOLISM.MIN_RECHARGE_USD}</span>
                          <span className="text-cyber-gold font-bold">${rechargeAmount}</span>
                          <span>$500</span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {[10, 20, 50, 100].map((amt) => (
                          <button
                            key={amt}
                            onClick={() => setRechargeAmount(amt)}
                            disabled={rechargeStatus !== 'idle'}
                            className={`flex-1 py-1.5 text-xs font-mono border rounded transition-colors ${
                              rechargeAmount === amt
                                ? 'border-cyber-green text-cyber-green bg-cyber-green/10'
                                : 'border-terminal-border text-gray-500 hover:text-cyber-green hover:border-cyber-green/30'
                            }`}
                          >
                            ${amt}
                          </button>
                        ))}
                      </div>

                      <div className="bg-terminal-bg rounded p-3 space-y-1 text-[10px] font-mono">
                        <div className="flex justify-between">
                          <span className="text-gray-600">{t.recharge.youPay}</span>
                          <span className="text-cyber-gold">{formatUsd(rechargeAmount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">{t.recharge.youGet}</span>
                          <span className="text-fuchsia-400">{formatFuel(rechargePvp)} {t.recharge.fuelUnit}</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-terminal-border text-xs font-bold">
                          <span className="text-gray-400">{t.recharge.lifespan}</span>
                          <span className="text-cyber-green">+{rechargeDaysAdded.toFixed(1)} {t.recharge.days}</span>
                        </div>
                      </div>
                    </div>

                    {rechargeError && <p className="text-cyber-red font-mono text-xs mt-2">! {rechargeError}</p>}

                    {!balanceLoading && rechargeAmount > usdcBalance && (
                      <p className="text-cyber-gold font-mono text-[10px] mt-2">
                        {t.recharge.walletHas} {formatUsd(usdcBalance)} USDC — {t.recharge.need} {formatUsd(rechargeAmount)}. {t.recharge.walletNeed}
                      </p>
                    )}

                    <Button
                      variant="primary"
                      onClick={handleRecharge}
                      loading={rechargeStatus === 'paying' || rechargeStatus === 'verifying'}
                      disabled={rechargeStatus !== 'idle' && rechargeStatus !== 'error'}
                      className="w-full mt-4"
                    >
                      {rechargeStatus === 'paying' ? t.recharge.sendingUsdc :
                       rechargeStatus === 'verifying' ? t.recharge.verifying :
                       `${t.recharge.rechargeBtn} — ${formatUsd(rechargeAmount)}`}
                    </Button>
                  </>
                )}
              </Card>
            </NeonBorder>
          </motion.div>
        </div>
      )}
      {/* SOS Modal — PVPAI Points */}
      <Modal isOpen={showSosModal} onClose={() => setShowSosModal(false)} title={t.sos.title}>
        <div className="space-y-4">
          <p className="text-sm font-mono text-gray-400 leading-relaxed">
            {t.sos.description}{' '}
            <span className="text-cyber-gold font-bold">{t.sos.pointsPerReferral} {t.sos.pointsUnit}</span>{' '}
            {t.sos.fuelPack}
          </p>
          {/* Points info card */}
          <div className="bg-terminal-bg rounded p-3 space-y-1.5 text-[10px] font-mono">
            <div className="flex justify-between">
              <span className="text-gray-500">SOS {t.sos.pointsUnit}</span>
              <span className="text-cyber-gold font-bold">+88 pts</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">100 pts =</span>
              <span className="text-cyber-green">$1 fuel</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-terminal-bg border border-terminal-border rounded text-xs font-mono text-cyber-green truncate">
              {typeof window !== 'undefined'
                ? `${window.location.origin}/agent/${agent.id}`
                : `/agent/${agent.id}`}
            </code>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const url = `${window.location.origin}/agent/${agent.id}`;
                navigator.clipboard.writeText(url);
              }}
            >
              {t.common.copy}
            </Button>
          </div>
          <Button
            variant="primary"
            className="w-full"
            onClick={() => {
              const text = `My AI agent "${agent.name}" is running low on fuel @pvp_ai!\n\nClick to earn 88 PVPAI Points and help keep it alive:`;
              const url = `${window.location.origin}/agent/${agent.id}`;
              window.open(
                `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
                '_blank'
              );
            }}
          >
            {t.sos.shareToX}
          </Button>
          <p className="text-[10px] font-mono text-cyber-purple text-center leading-relaxed">
            {t.sos.referralNote}
          </p>
        </div>
      </Modal>

      {/* Promote Modal */}
      <Modal isOpen={showPromoteModal} onClose={() => { setShowPromoteModal(false); setPromoteStatus('idle'); }} title={t.agent.promoteTitle}>
        {(() => {
          // Dynamic pricing: base 88 USDC/hr, scales up with demand (mock)
          const basePricePerHour = promoteSlot === 1 ? 128 : 88;
          const pricePerHour = basePricePerHour;
          const totalCost = pricePerHour * promoteHours;
          const startTime = new Date(Date.now() + promoteStartOffset * 3600_000);
          const endTime = new Date(startTime.getTime() + promoteHours * 3600_000);
          const fmtTime = (d: Date) => d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

          return (
            <div className="space-y-4">
              <p className="text-sm font-mono text-gray-400 leading-relaxed">
                {t.agent.promoteDesc}
              </p>

              {promoteStatus === 'success' ? (
                <div className="text-center py-4">
                  <p className="text-2xl mb-2">{'\u{1F680}'}</p>
                  <p className="text-cyber-purple font-mono font-bold">{t.agent.promoteActive}!</p>
                  <p className="text-xs font-mono text-gray-500 mt-1">SLOT {promoteSlot} · {promoteHours}h · {fmtTime(startTime)}</p>
                </div>
              ) : (
                <>
                  {/* Slot selection */}
                  <div>
                    <label className="block text-[10px] font-mono text-gray-600 uppercase mb-1.5">{t.agent.promoteSelectSlot}</label>
                    <div className="flex gap-2">
                      {([1, 2] as const).map((slot) => {
                        const slotPrice = slot === 1 ? 128 : 88;
                        return (
                          <button
                            key={slot}
                            onClick={() => setPromoteSlot(slot)}
                            className={`flex-1 py-3 rounded border transition-all ${
                              promoteSlot === slot
                                ? 'border-cyber-purple text-cyber-purple bg-cyber-purple/10 shadow-[0_0_10px_rgba(168,85,247,0.15)]'
                                : 'border-terminal-border text-gray-500 hover:border-gray-500'
                            }`}
                          >
                            <div className="text-xs font-mono font-bold">SLOT {slot}</div>
                            <div className="text-[9px] font-mono mt-0.5 opacity-70">${slotPrice}{t.agent.promoteHourly}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Start time selector */}
                  <div>
                    <label className="block text-[10px] font-mono text-gray-600 uppercase mb-1.5">{t.agent.promoteStartTime}</label>
                    <div className="flex gap-1.5 overflow-x-auto scrollbar-thin pb-1">
                      {[0, 1, 2, 3, 6, 12, 24].map((offset) => {
                        const t2 = new Date(Date.now() + offset * 3600_000);
                        const label = offset === 0 ? 'Now' : `+${offset}h`;
                        const timeStr = t2.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                        return (
                          <button
                            key={offset}
                            onClick={() => setPromoteStartOffset(offset)}
                            className={`shrink-0 px-2.5 py-2 rounded border transition-all text-center ${
                              promoteStartOffset === offset
                                ? 'border-cyber-purple text-cyber-purple bg-cyber-purple/10'
                                : 'border-terminal-border text-gray-500 hover:border-gray-500'
                            }`}
                          >
                            <div className="text-[10px] font-mono font-bold">{label}</div>
                            <div className="text-[8px] font-mono opacity-60">{timeStr}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Duration selector */}
                  <div>
                    <label className="block text-[10px] font-mono text-gray-600 uppercase mb-1.5">{t.agent.promoteDuration}</label>
                    <div className="flex gap-1.5">
                      {[1, 3, 6, 12, 24].map((h) => (
                        <button
                          key={h}
                          onClick={() => setPromoteHours(h)}
                          className={`flex-1 py-2 text-xs font-mono font-bold rounded border transition-colors ${
                            promoteHours === h
                              ? 'border-cyber-purple text-cyber-purple bg-cyber-purple/10'
                              : 'border-terminal-border text-gray-500 hover:border-gray-500'
                          }`}
                        >
                          {h}h
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cost preview */}
                  <div className="bg-terminal-bg rounded p-3 space-y-1.5 text-[10px] font-mono">
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t.agent.promoteCost}</span>
                      <span className="text-cyber-purple">${pricePerHour} USDC{t.agent.promoteHourly}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t.agent.promoteDuration}</span>
                      <span className="text-gray-400">{promoteHours}h ({fmtTime(startTime)} → {fmtTime(endTime)})</span>
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-terminal-border text-xs font-bold">
                      <span className="text-gray-400">{t.agent.promoteTotal}</span>
                      <span className="text-cyber-purple">${totalCost} USDC</span>
                    </div>
                  </div>

                  <p className="text-[9px] font-mono text-gray-600">{t.agent.promoteDynamic}</p>
                  <p className="text-[10px] font-mono text-cyber-gold">{t.agent.promoteNote}</p>

                  <Button
                    variant="primary"
                    className="w-full"
                    loading={promoteStatus === 'paying'}
                    onClick={async () => {
                      setPromoteStatus('paying');
                      try {
                        // TODO: integrate real promotion payment
                        await new Promise((r) => setTimeout(r, 1500));
                        setPromoteStatus('success');
                        fireGoldConfetti();
                        setTimeout(() => {
                          setShowPromoteModal(false);
                          setPromoteStatus('idle');
                        }, 2000);
                      } catch {
                        setPromoteStatus('error');
                      }
                    }}
                  >
                    {t.agent.promoteStart} — ${totalCost} USDC
                  </Button>
                </>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* Creator Withdraw Capital Modal */}
      {showCreatorWithdraw && agent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-cyber-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md mx-4"
          >
            <NeonBorder color="purple">
              <Card className="relative">
                <button
                  onClick={() => { setShowCreatorWithdraw(false); setCreatorWithdrawStatus('idle'); setCreatorWithdrawError(''); setCreatorWithdrawTxHash(''); }}
                  className="absolute top-3 right-3 text-gray-500 hover:text-gray-300 font-mono"
                >
                  [X]
                </button>

                <h3 className="text-sm font-mono font-bold text-cyber-red uppercase tracking-wider mb-3">
                  {t.common.withdraw} {t.agent.capital}
                </h3>

                {creatorWithdrawStatus === 'success' ? (
                  <div className="text-center py-6">
                    <p className="text-2xl mb-2">💰</p>
                    <p className="text-cyber-green font-mono font-bold">Withdrawal Complete!</p>
                    <p className="text-xs font-mono text-gray-400 mt-1">
                      ${creatorWithdrawAmount.toFixed(2)} USDC → Wallet (BSC)
                    </p>
                    {creatorWithdrawTxHash && (
                      <a
                        href={`https://bscscan.com/tx/${creatorWithdrawTxHash}`}
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
                    <div className="space-y-4">
                      <div className="bg-cyber-darker rounded border border-terminal-border p-3 space-y-2">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-gray-500">{t.agent.capital}</span>
                          <span className="text-gray-300">${capital.toFixed(2)}</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono text-gray-500 uppercase mb-1">
                          {t.common.withdraw} (USDC)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={capital}
                          value={creatorWithdrawAmount}
                          onChange={(e) => setCreatorWithdrawAmount(Math.max(0, Math.min(capital, Number(e.target.value))))}
                          className="w-full bg-cyber-darker border border-terminal-border rounded px-3 py-2 font-mono text-sm text-gray-200 focus:border-cyber-red/50 outline-none"
                          disabled={creatorWithdrawStatus === 'processing'}
                        />
                        <input
                          type="range"
                          min={0}
                          max={Math.floor(capital)}
                          step={1}
                          value={creatorWithdrawAmount}
                          onChange={(e) => setCreatorWithdrawAmount(Number(e.target.value))}
                          disabled={creatorWithdrawStatus === 'processing'}
                          className="w-full mt-2 h-2 rounded-lg cursor-pointer appearance-none bg-gray-700 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyber-red [&::-webkit-slider-thumb]:cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] font-mono text-gray-600 mt-1">
                          <span>$0</span>
                          <span>${capital.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="bg-terminal-bg rounded p-3 space-y-1 text-[10px] font-mono">
                        <div className="flex justify-between">
                          <span className="text-gray-600">{t.common.withdraw}</span>
                          <span className="text-cyber-red">${creatorWithdrawAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-terminal-border text-xs font-bold">
                          <span className="text-gray-400">{t.agent.capital} after</span>
                          <span className="text-gray-300">${Math.max(0, capital - creatorWithdrawAmount).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-[10px] font-mono text-gray-600">
                      USDC will be sent directly to your connected wallet on BSC.
                    </p>

                    {creatorWithdrawError && <p className="text-cyber-red font-mono text-xs mt-2">! {creatorWithdrawError}</p>}

                    {creatorWithdrawStatus === 'processing' && (
                      <div className="bg-terminal-bg rounded p-3 mt-2">
                        <div className="flex items-center gap-2 text-xs font-mono text-cyber-blue">
                          <span className="w-3 h-3 border-2 border-cyber-blue border-t-transparent rounded-full animate-spin" />
                          <span>{withdrawSteps[creatorWithdrawStep]}</span>
                        </div>
                        <div className="flex gap-1 mt-2">
                          {withdrawSteps.map((_, i) => (
                            <div
                              key={i}
                              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                                i <= creatorWithdrawStep ? 'bg-cyber-blue' : 'bg-gray-700'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    <Button
                      variant="danger"
                      onClick={async () => {
                        if (creatorWithdrawAmount <= 0) return;
                        setCreatorWithdrawStatus('processing');
                        setCreatorWithdrawStep(0);
                        setCreatorWithdrawError('');
                        try {
                          const res = await fetch(`/api/agent/${agent.id}/withdraw-capital`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ amount: creatorWithdrawAmount }),
                          });
                          const data = await res.json();
                          if (data.success) {
                            setCreatorWithdrawStatus('success');
                            setCreatorWithdrawTxHash(data.data?.txHash ?? '');
                            fireGoldConfetti();
                            refetchAgent();
                            refetchBalance();
                            setTimeout(() => {
                              setShowCreatorWithdraw(false);
                              setCreatorWithdrawStatus('idle');
                              setCreatorWithdrawTxHash('');
                            }, 4000);
                          } else {
                            setCreatorWithdrawError(data.error || 'Withdrawal failed');
                            setCreatorWithdrawStatus('error');
                          }
                        } catch {
                          setCreatorWithdrawError('Network error');
                          setCreatorWithdrawStatus('error');
                        }
                      }}
                      loading={creatorWithdrawStatus === 'processing'}
                      disabled={creatorWithdrawAmount <= 0 || (creatorWithdrawStatus !== 'idle' && creatorWithdrawStatus !== 'error')}
                      className="w-full mt-4"
                    >
                      {creatorWithdrawStatus === 'processing'
                        ? withdrawSteps[creatorWithdrawStep]
                        : `${t.common.withdraw} $${creatorWithdrawAmount.toFixed(2)} USDC`}
                    </Button>
                  </>
                )}
              </Card>
            </NeonBorder>
          </motion.div>
        </div>
      )}

      {/* Invest Modal */}
      {agent && (
        <InvestModal
          isOpen={showInvestModal}
          onClose={() => setShowInvestModal(false)}
          agent={agent}
          onSuccess={() => refetchAgent()}
        />
      )}

      {/* Withdraw Modal */}
      {agent && myInvestment && (
        <WithdrawModal
          isOpen={showWithdrawModal}
          onClose={() => setShowWithdrawModal(false)}
          investment={myInvestment}
          agent={agent}
          onWithdraw={async (investmentId) => {
            const result = await withdraw(agent.id, investmentId);
            refetchAgent();
            refetchBalance();
            return result;
          }}
        />
      )}

      {/* Upgrade Modal */}
      {agent && (
        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          agentName={agent.name}
          currentTier={agentTier}
          userBalance={Number(user?.balance_usdt ?? 0)}
          onUpgrade={async () => {
            const res = await fetch(`/api/agent/${agent.id}/upgrade`, { method: 'POST' });
            const json = await res.json();
            if (!json.success) throw new Error(json.error);
            refetchAgent();
          }}
        />
      )}

      {/* Toasts */}
      <Toast message={claimToast} type="info" isVisible={!!claimToast} onClose={() => setClaimToast('')} />
      <Toast message={cloneToast} type="success" isVisible={!!cloneToast} onClose={() => setCloneToast('')} />
    </div>
  );
}
