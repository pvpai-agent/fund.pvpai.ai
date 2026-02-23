'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useT } from '@/hooks/useTranslation';
import { useUser } from '@/hooks/useUser';
import { useAgents } from '@/hooks/useAgents';
import { useInvestments } from '@/hooks/useInvestments';
import { useTransactions } from '@/hooks/useTransactions';
import { useConfetti } from '@/hooks/useConfetti';
import { formatUsd, formatPnl, formatFuel, estimateLifespan } from '@/lib/utils/format';
import { AGENT_TIERS } from '@/constants/trading';
import type { AgentTier } from '@/constants/trading';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { WithdrawModal } from '@/components/agent/WithdrawModal';
import type { Agent, Investment, Transaction, TxType } from '@/types/database';

type DashTab = 'creations' | 'portfolio' | 'ledger';

// ── Tx type display config ──
const TX_TYPE_CONFIG: Record<string, { label: string; color: string; isInflow: boolean }> = {
  agent_mint:            { label: 'DEPLOY',    color: 'text-fuchsia-400 border-fuchsia-400/40 bg-fuchsia-400/10', isInflow: false },
  deposit:              { label: 'DEPOSIT',   color: 'text-cyber-blue border-cyber-blue/40 bg-cyber-blue/10',     isInflow: false },
  investment:           { label: 'INVEST',    color: 'text-cyber-gold border-cyber-gold/40 bg-cyber-gold/10',     isInflow: false },
  energy_purchase:      { label: 'REFUEL',    color: 'text-orange-400 border-orange-400/40 bg-orange-400/10',     isInflow: false },
  upgrade_fee:          { label: 'UPGRADE',   color: 'text-cyan-400 border-cyan-400/40 bg-cyan-400/10',           isInflow: false },
  loot_fee:             { label: 'LOOT',      color: 'text-amber-400 border-amber-400/40 bg-amber-400/10',        isInflow: false },
  withdrawal:           { label: 'WITHDRAW',  color: 'text-cyber-green border-cyber-green/40 bg-cyber-green/10',  isInflow: true },
  capital_withdrawal:   { label: 'WITHDRAW',  color: 'text-cyber-green border-cyber-green/40 bg-cyber-green/10',  isInflow: true },
  investment_withdrawal:{ label: 'WITHDRAW',  color: 'text-cyber-green border-cyber-green/40 bg-cyber-green/10',  isInflow: true },
  creator_claim:        { label: 'CLAIM',     color: 'text-cyber-green border-cyber-green/40 bg-cyber-green/10',  isInflow: true },
  creator_fee:          { label: 'FEE',       color: 'text-cyber-green border-cyber-green/40 bg-cyber-green/10',  isInflow: true },
  trade_pnl:            { label: 'TRADE',     color: 'text-gray-400 border-gray-500/40 bg-gray-500/10',           isInflow: false },
  referral_fee:         { label: 'REFERRAL',  color: 'text-cyber-purple border-cyber-purple/40 bg-cyber-purple/10', isInflow: true },
  clone_fuel_referral:  { label: 'CLONE REF', color: 'text-cyber-purple border-cyber-purple/40 bg-cyber-purple/10', isInflow: true },
  capital_return:       { label: 'RETURN',    color: 'text-cyber-green border-cyber-green/40 bg-cyber-green/10',  isInflow: true },
  energy_burn:          { label: 'BURN',      color: 'text-red-500 border-red-500/40 bg-red-500/10',              isInflow: false },
};

function getTxDisplay(type: TxType) {
  return TX_TYPE_CONFIG[type] ?? { label: type.toUpperCase().replace(/_/g, ' '), color: 'text-gray-400 border-gray-600/40 bg-gray-600/10', isInflow: false };
}

function formatTxTime(iso: string) {
  const d = new Date(iso);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hours}:${mins}`;
}

function shortenHash(hash: string) {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

// Mock data shown when no real transactions exist
const MOCK_TRANSACTIONS: Transaction[] = [
  { id: 'mock-1', user_id: '', agent_id: 'agent-2', type: 'agent_mint', status: 'confirmed', amount: 50, token: 'USDC', chain: 'bsc', tx_hash: '0xabc1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd', description: 'Jensen Seller', balance_before: null, balance_after: null, created_at: new Date(Date.now() - 86400000 * 3).toISOString() },
  { id: 'mock-2', user_id: '', agent_id: 'agent-1', type: 'deposit', status: 'confirmed', amount: 100, token: 'USDC', chain: 'bsc', tx_hash: '0xdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd', description: 'NVDA Dip Buyer', balance_before: null, balance_after: null, created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: 'mock-3', user_id: '', agent_id: 'agent-2', type: 'creator_claim', status: 'confirmed', amount: 12.5, token: 'USDC', chain: 'bsc', tx_hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', description: 'Jensen Seller', balance_before: null, balance_after: null, created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: 'mock-4', user_id: '', agent_id: 'agent-2', type: 'energy_purchase', status: 'confirmed', amount: 5, token: 'USDC', chain: 'bsc', tx_hash: '0x4567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234', description: 'Jensen Seller', balance_before: null, balance_after: null, created_at: new Date(Date.now() - 3600000).toISOString() },
];

export default function DashboardPage() {
  const t = useT();
  const { user, isLoading: userLoading } = useUser();
  const { agents, isLoading: agentsLoading, refetchAgents } = useAgents();
  const { investments, isLoading: investmentsLoading, withdraw } = useInvestments();
  const { transactions, isLoading: txLoading } = useTransactions();
  const [tab, setTab] = useState<DashTab>('creations');
  const [withdrawTarget, setWithdrawTarget] = useState<{ investment: Investment; agent: Agent } | null>(null);

  const { fireGoldConfetti } = useConfetti();
  const [pnlWithdrawing, setPnlWithdrawing] = useState(false);
  const [pnlWithdrawn, setPnlWithdrawn] = useState('');
  const [commClaiming, setCommClaiming] = useState(false);
  const [commClaimed, setCommClaimed] = useState('');

  const totalPnl = agents.reduce((sum, a) => sum + Number(a.total_pnl), 0);
  const totalTrades = agents.reduce((sum, a) => sum + Number(a.total_trades), 0);
  const totalCapital = agents.reduce((sum, a) => sum + Number(a.capital_balance), 0);
  const totalCreatorEarnings = agents.reduce((sum, a) => sum + Number(a.creator_earnings), 0);
  const overallWinRate = totalTrades > 0
    ? agents.reduce((sum, a) => sum + Number(a.win_rate) * Number(a.total_trades), 0) / totalTrades
    : 0;

  // Batch withdraw all P&L from agents with positive pnl
  const handleWithdrawAllPnl = useCallback(async () => {
    const eligible = agents.filter((a) => Number(a.total_pnl) > 0 && Number(a.capital_balance) > 0);
    if (eligible.length === 0) return;
    setPnlWithdrawing(true);
    setPnlWithdrawn('');
    let totalWithdrawn = 0;
    try {
      for (const agent of eligible) {
        const withdrawAmount = Math.min(Number(agent.total_pnl), Number(agent.capital_balance));
        if (withdrawAmount <= 0) continue;
        const res = await fetch(`/api/agent/${agent.id}/withdraw-capital`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: withdrawAmount }),
        });
        const data = await res.json();
        if (data.success) totalWithdrawn += withdrawAmount;
      }
      if (totalWithdrawn > 0) {
        setPnlWithdrawn(totalWithdrawn.toFixed(2));
        fireGoldConfetti();
        refetchAgents();
      }
    } catch (err) {
      console.error('Batch withdraw error:', err);
    } finally {
      setPnlWithdrawing(false);
    }
  }, [agents, fireGoldConfetti, refetchAgents]);

  // Batch claim all creator earnings
  const handleClaimAll = useCallback(async () => {
    const eligible = agents.filter((a) => Number(a.creator_earnings) > 0);
    if (eligible.length === 0) return;
    setCommClaiming(true);
    setCommClaimed('');
    let totalClaimed = 0;
    try {
      for (const agent of eligible) {
        const res = await fetch(`/api/agent/${agent.id}/claim`, { method: 'POST' });
        const data = await res.json();
        if (data.success) totalClaimed += data.data.claimed;
      }
      if (totalClaimed > 0) {
        setCommClaimed(totalClaimed.toFixed(2));
        fireGoldConfetti();
        refetchAgents();
      }
    } catch (err) {
      console.error('Batch claim error:', err);
    } finally {
      setCommClaiming(false);
    }
  }, [agents, fireGoldConfetti, refetchAgents]);

  // Build agent name lookup for the ledger
  const agentNameMap = new Map(agents.map((a) => [a.id, a.name]));

  // Use real transactions, fall back to mock if empty
  const ledgerRows = transactions.length > 0 ? transactions : MOCK_TRANSACTIONS;

  if (userLoading || agentsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-mono font-bold text-cyber-green uppercase tracking-wider">
          {t.dashboard.title}
        </h1>
        <Link href="/agent/new">
          <Button variant="primary" size="sm">
            {t.common.deployAgent}
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Funds = all capital across agents (includes initial + profits) */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card variant="glow">
            <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">
              {t.dashboard.totalFunds}
            </p>
            <p className="text-3xl font-bold text-cyber-gold">
              {formatUsd(totalCapital)}
            </p>
            <p className="text-xs font-mono text-gray-600 mt-2">
              {t.dashboard.totalFundsNote.replace('{n}', String(agents.length))}
            </p>
          </Card>
        </motion.div>

        {/* Total P&L with withdraw button */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">
              {t.dashboard.totalPnl}
            </p>
            <p className={`text-3xl font-bold ${totalPnl >= 0 ? 'text-cyber-green' : 'text-cyber-red'}`}>
              {formatPnl(totalPnl)}
            </p>
            <p className="text-[10px] font-mono text-gray-600 mt-1">
              {t.dashboard.totalPnlNote
                .replace('{n}', String(totalTrades))
                .replace('{rate}', overallWinRate.toFixed(0))}
            </p>
            {pnlWithdrawn ? (
              <p className="mt-2 text-[10px] font-mono text-cyber-green">
                {t.dashboard.withdrawSuccess.replace('{amount}', pnlWithdrawn)}
              </p>
            ) : totalPnl > 0 ? (
              <button
                onClick={handleWithdrawAllPnl}
                disabled={pnlWithdrawing}
                className="mt-2 w-full py-1.5 text-[10px] font-mono uppercase tracking-wider border border-cyber-green/40 text-cyber-green rounded hover:bg-cyber-green/10 transition-colors disabled:opacity-50"
              >
                {pnlWithdrawing ? t.dashboard.withdrawing : `${t.dashboard.withdrawAll} $${totalPnl.toFixed(2)}`}
              </button>
            ) : null}
          </Card>
        </motion.div>

        {/* Commission Income with claim button */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">
              {t.dashboard.commissionIncome}
            </p>
            <p className="text-3xl font-bold text-cyber-purple">
              {formatUsd(totalCreatorEarnings)}
            </p>
            <p className="text-[10px] font-mono text-gray-600 mt-1">
              {t.dashboard.commissionNote}
            </p>
            {commClaimed ? (
              <p className="mt-2 text-[10px] font-mono text-cyber-green">
                {t.dashboard.claimSuccess.replace('{amount}', commClaimed)}
              </p>
            ) : totalCreatorEarnings > 0 ? (
              <button
                onClick={handleClaimAll}
                disabled={commClaiming}
                className="mt-2 w-full py-1.5 text-[10px] font-mono uppercase tracking-wider border border-cyber-purple/40 text-cyber-purple rounded hover:bg-cyber-purple/10 transition-colors disabled:opacity-50"
              >
                {commClaiming ? t.dashboard.claiming : `${t.dashboard.claimAll} $${totalCreatorEarnings.toFixed(2)}`}
              </button>
            ) : null}
          </Card>
        </motion.div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-terminal-border">
        <button
          onClick={() => setTab('creations')}
          className={`px-6 py-2.5 text-xs font-mono uppercase tracking-wider transition-colors ${
            tab === 'creations'
              ? 'text-cyber-green border-b-2 border-cyber-green bg-cyber-green/5'
              : 'text-gray-600 hover:text-gray-400'
          }`}
        >
          {t.dashboard.myCreations}
        </button>
        <button
          onClick={() => setTab('portfolio')}
          className={`px-6 py-2.5 text-xs font-mono uppercase tracking-wider transition-colors ${
            tab === 'portfolio'
              ? 'text-cyber-gold border-b-2 border-cyber-gold bg-cyber-gold/5'
              : 'text-gray-600 hover:text-gray-400'
          }`}
        >
          {t.dashboard.myPortfolio}
          {investments.filter((i) => i.status === 'active').length > 0 && (
            <span className="ml-2 text-[10px] bg-cyber-gold/20 text-cyber-gold px-1.5 py-0.5 rounded">
              {investments.filter((i) => i.status === 'active').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('ledger')}
          className={`px-6 py-2.5 text-xs font-mono uppercase tracking-wider transition-colors ${
            tab === 'ledger'
              ? 'text-cyber-blue border-b-2 border-cyber-blue bg-cyber-blue/5'
              : 'text-gray-600 hover:text-gray-400'
          }`}
        >
          {t.dashboard.ledger}
        </button>
      </div>

      {/* Creations Tab */}
      {tab === 'creations' && (
        <div>
          {agents.length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-gray-500 font-mono text-sm mb-4">
                {t.dashboard.noAgents}
              </p>
              <Link href="/agent/new">
                <Button variant="primary">{t.dashboard.deployFirst}</Button>
              </Link>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {agents.map((agent, i) => {
                const isDead = agent.status === 'dead';
                const pvpBalance = Number(agent.energy_balance);
                const energyPct = isDead ? 0 : Math.min(100, (pvpBalance / 10000) * 100);
                const lifeHours = isDead ? 0 : estimateLifespan(pvpBalance, Number(agent.burn_rate_per_hour));
                const lifeDays = lifeHours / 24;
                const isCritical = !isDead && lifeHours < 24;
                const agentTier = (agent.parsed_rules?.tier as AgentTier) ?? 'sniper';
                const tierConfig = AGENT_TIERS[agentTier];

                return (
                  <motion.div
                    key={agent.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * i }}
                  >
                    <Link href={`/agent/${agent.id}`}>
                      <Card className={`hover:border-cyber-green/30 transition-all duration-200 cursor-pointer group ${isDead ? 'opacity-50 grayscale' : ''}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded border ${isDead ? 'border-gray-600 bg-gray-800' : 'border-cyber-green/30 bg-cyber-green/5'} flex items-center justify-center text-lg`}>
                              {isDead ? 'x_x' : tierConfig?.icon ?? '?'}
                            </div>
                            <div>
                              <h3 className="font-mono font-bold text-sm text-gray-200 group-hover:text-cyber-green transition-colors">
                                {agent.name}
                              </h3>
                              <p className="text-xs font-mono text-gray-600 truncate max-w-[200px]">
                                {tierConfig?.name ?? 'Agent'} — {agent.parsed_rules.description || agent.prompt.slice(0, 50)}
                              </p>
                            </div>
                          </div>
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

                        <div className="mt-3">
                          <div className="flex justify-between text-[10px] font-mono">
                            <span className="text-gray-600">FUEL</span>
                            <span className={isDead ? 'text-gray-600' : isCritical ? 'text-red-500' : 'text-cyber-green'}>
                              {isDead ? 'DEPLETED' : `${formatFuel(pvpBalance)} (~${lifeDays.toFixed(1)}d)`}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-800 rounded-full mt-0.5">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isDead ? 'bg-gray-600' :
                                isCritical ? 'bg-red-500 animate-pulse' :
                                'bg-gradient-to-r from-cyber-green to-cyber-blue'
                              }`}
                              style={{ width: `${energyPct}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex gap-2 mt-3 pt-3 border-t border-terminal-border" onClick={(e) => e.preventDefault()}>
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `/agent/${agent.id}`; }}
                            className="flex-1 py-1 text-[10px] font-mono uppercase tracking-wider border border-cyber-red/40 text-cyber-red rounded hover:bg-cyber-red/10 transition-colors"
                          >
                            {t.dashboard.refuel}
                          </button>
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `/agent/${agent.id}`; }}
                            className="flex-1 py-1 text-[10px] font-mono uppercase tracking-wider border border-cyber-blue/40 text-cyber-blue rounded hover:bg-cyber-blue/10 transition-colors"
                          >
                            {t.dashboard.terminalBtn}
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault(); e.stopPropagation();
                              navigator.clipboard.writeText(`${window.location.origin}/agent/${agent.id}`);
                            }}
                            className="flex-1 py-1 text-[10px] font-mono uppercase tracking-wider border border-cyber-gold/40 text-cyber-gold rounded hover:bg-cyber-gold/10 transition-colors"
                          >
                            {t.dashboard.sosLink}
                          </button>
                        </div>

                        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-terminal-border">
                          <div>
                            <p className="text-[10px] font-mono text-gray-600 uppercase">{t.dashboard.pnl}</p>
                            <p className={`text-sm font-bold ${Number(agent.total_pnl) >= 0 ? 'text-cyber-green' : 'text-cyber-red'}`}>
                              {formatPnl(Number(agent.total_pnl))}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-mono text-gray-600 uppercase">{t.dashboard.trades}</p>
                            <p className="text-sm font-bold text-gray-300">{agent.total_trades}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-mono text-gray-600 uppercase">{t.dashboard.winRateLabel}</p>
                            <p className="text-sm font-bold text-cyber-blue">{Number(agent.win_rate).toFixed(0)}%</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-mono text-gray-600 uppercase">{t.dashboard.capitalLabel}</p>
                            <p className="text-sm font-bold text-cyber-gold">{formatUsd(Number(agent.capital_balance))}</p>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Portfolio Tab */}
      {tab === 'portfolio' && (
        <div>
          {investmentsLoading || agentsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          ) : agents.length === 0 && investments.filter((i) => i.status === 'active').length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-gray-500 font-mono text-sm mb-2">
                {t.dashboard.noInvestments}
              </p>
              <p className="text-gray-600 font-mono text-xs">
                {t.dashboard.visitAgents}
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {/* Own agents as portfolio items (creator capital) */}
              {agents.map((agent) => {
                const invested = Number(agent.allocated_funds);
                const currentValue = Number(agent.capital_balance);
                const pnl = Number(agent.total_pnl);
                const pnlSign = pnl >= 0 ? '+' : '';
                const isDead = agent.status === 'dead';

                return (
                  <Card key={`own-${agent.id}`} className={`hover:border-cyber-green/30 transition-colors ${isDead ? 'opacity-50' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Link href={`/agent/${agent.id}`} className="font-mono font-bold text-sm text-gray-200 hover:text-cyber-green transition-colors">
                            {agent.name}
                          </Link>
                          <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-cyber-green/40 text-cyber-green bg-cyber-green/10">
                            CREATOR
                          </span>
                          {isDead && (
                            <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-red-500/40 text-red-500 bg-red-500/10">
                              K.I.A.
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-gray-500">
                          <span>{t.dashboard.invested} ${invested.toFixed(2)}</span>
                          <span>{t.dashboard.share} 100%</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono font-bold text-gray-200">
                          ${currentValue.toFixed(2)}
                        </p>
                        <p className={`text-xs font-mono ${pnl >= 0 ? 'text-cyber-green' : 'text-cyber-red'}`}>
                          {pnlSign}${pnl.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3 pt-3 border-t border-terminal-border">
                      <Link href={`/agent/${agent.id}`} className="flex-1">
                        <button className="w-full py-1.5 text-[10px] font-mono uppercase tracking-wider border border-cyber-blue/40 text-cyber-blue rounded hover:bg-cyber-blue/10 transition-colors">
                          {t.common.viewAgent}
                        </button>
                      </Link>
                    </div>
                  </Card>
                );
              })}

              {/* External investments (invested in others' agents) */}
              {investments
                .filter((i) => i.status === 'active')
                .map((inv) => {
                  const agent = inv.agent;
                  if (!agent) return null;
                  const currentValue = (inv.share_pct / 100) * agent.capital_balance;
                  const pnl = currentValue - inv.amount;
                  const pnlSign = pnl >= 0 ? '+' : '';

                  return (
                    <Card key={inv.id} className="hover:border-cyber-gold/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Link href={`/agent/${agent.id}`} className="font-mono font-bold text-sm text-gray-200 hover:text-cyber-green transition-colors">
                              {agent.name}
                            </Link>
                            <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-cyber-gold/40 text-cyber-gold bg-cyber-gold/10">
                              INVESTOR
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-gray-500">
                            <span>{t.dashboard.invested} ${inv.amount.toFixed(2)}</span>
                            <span>{t.dashboard.share} {inv.share_pct.toFixed(2)}%</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-mono font-bold text-gray-200">
                            ${currentValue.toFixed(2)}
                          </p>
                          <p className={`text-xs font-mono ${pnl >= 0 ? 'text-cyber-green' : 'text-cyber-red'}`}>
                            {pnlSign}${pnl.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3 pt-3 border-t border-terminal-border">
                        <Link href={`/agent/${agent.id}`} className="flex-1">
                          <button className="w-full py-1.5 text-[10px] font-mono uppercase tracking-wider border border-cyber-blue/40 text-cyber-blue rounded hover:bg-cyber-blue/10 transition-colors">
                            {t.common.viewAgent}
                          </button>
                        </Link>
                        <button
                          onClick={() => setWithdrawTarget({ investment: inv, agent })}
                          className="flex-1 py-1.5 text-[10px] font-mono uppercase tracking-wider border border-cyber-red/40 text-cyber-red rounded hover:bg-cyber-red/10 transition-colors"
                        >
                          {t.common.withdraw}
                        </button>
                      </div>
                    </Card>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* Ledger Tab */}
      {tab === 'ledger' && (
        <div>
          {txLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (
            <div className="rounded border border-terminal-border overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[100px_90px_1fr_1fr_1fr] bg-cyber-darker border-b border-terminal-border px-4 py-2.5">
                <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">{t.dashboard.ledgerTime}</span>
                <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">{t.dashboard.ledgerType}</span>
                <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">{t.dashboard.ledgerAmount}</span>
                <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">{t.dashboard.ledgerAgent}</span>
                <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider text-right">{t.dashboard.ledgerStatus}</span>
              </div>

              {/* Table rows */}
              {ledgerRows.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <p className="text-gray-500 font-mono text-sm">{t.dashboard.ledgerEmpty}</p>
                </div>
              ) : (
                ledgerRows.map((tx, i) => {
                  const display = getTxDisplay(tx.type);
                  const isInflow = display.isInflow;
                  // For trade_pnl, determine direction by looking at if amount is described as positive
                  const agentName = tx.agent_id
                    ? agentNameMap.get(tx.agent_id) ?? tx.description ?? '—'
                    : tx.description ?? '—';

                  return (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.03 * i }}
                      className="grid grid-cols-[100px_90px_1fr_1fr_1fr] px-4 py-3 border-b border-terminal-border/50 hover:bg-white/[0.02] transition-colors items-center"
                    >
                      {/* Time */}
                      <span className="text-[11px] font-mono text-gray-500">
                        {formatTxTime(tx.created_at)}
                      </span>

                      {/* Type badge */}
                      <span>
                        <span className={`inline-block text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${display.color}`}>
                          {display.label}
                        </span>
                      </span>

                      {/* Amount */}
                      <span className={`text-xs font-mono font-bold ${isInflow ? 'text-cyber-green' : 'text-gray-300'}`}>
                        {isInflow ? '+' : '-'}${tx.amount.toFixed(2)} <span className="text-gray-600 font-normal">USDC</span>
                      </span>

                      {/* Agent */}
                      <span className="text-xs font-mono text-gray-400 truncate">
                        {tx.agent_id ? (
                          <Link href={`/agent/${tx.agent_id}`} className="hover:text-cyber-green transition-colors">
                            {agentName}
                          </Link>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </span>

                      {/* Status + tx hash */}
                      <span className="text-right">
                        {tx.status === 'confirmed' ? (
                          <span className="text-[10px] font-mono text-cyber-green">
                            {t.dashboard.ledgerConfirmed}
                          </span>
                        ) : tx.status === 'pending' ? (
                          <span className="text-[10px] font-mono text-cyber-gold animate-pulse">
                            {t.dashboard.ledgerPending}
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-cyber-red">
                            {t.dashboard.ledgerFailed}
                          </span>
                        )}
                        {tx.tx_hash && (
                          <a
                            href={`https://bscscan.com/tx/${tx.tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-[10px] font-mono text-gray-600 hover:text-cyber-blue transition-colors"
                          >
                            {shortenHash(tx.tx_hash)}
                          </a>
                        )}
                      </span>
                    </motion.div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {user?.referral_code && (
        <Card className="mt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">
                {t.dashboard.referralCode}
              </p>
              <p className="text-lg font-mono font-bold text-cyber-purple">
                {user.referral_code}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(user.referral_code);
              }}
            >
              {t.common.copy}
            </Button>
          </div>
          <p className="text-[10px] font-mono text-gray-600 mt-2">
            {t.dashboard.referralNote}
          </p>
        </Card>
      )}

      {/* Withdraw Modal */}
      {withdrawTarget && (
        <WithdrawModal
          isOpen={!!withdrawTarget}
          onClose={() => setWithdrawTarget(null)}
          investment={withdrawTarget.investment}
          agent={withdrawTarget.agent}
          onWithdraw={async (investmentId) => {
            const result = await withdraw(withdrawTarget.agent.id, investmentId);
            setWithdrawTarget(null);
            return result;
          }}
        />
      )}
    </div>
  );
}
