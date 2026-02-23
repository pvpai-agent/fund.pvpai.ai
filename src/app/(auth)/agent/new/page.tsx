'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAccount } from 'wagmi';
import { v4 as uuidv4 } from 'uuid';
import { useUser } from '@/hooks/useUser';
import { usePayment } from '@/hooks/usePayment';
import { useUsdcBalance } from '@/hooks/useUsdcBalance';
import { useConfetti } from '@/hooks/useConfetti';
import { formatUsd, formatFuel } from '@/lib/utils/format';
import { METABOLISM, AGENT_TIERS, DATA_SOURCES } from '@/constants/trading';
import type { AgentTier, DataSourceId } from '@/constants/trading';
import { useT } from '@/hooks/useTranslation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { TerminalText } from '@/components/effects/TerminalText';
import { NeonBorder } from '@/components/effects/NeonBorder';
import type { ParsedRules } from '@/types/database';

/* ─── Types ─── */
type Step = 'prompt' | 'genesis' | 'package' | 'deploy' | 'deploying' | 'success';

/* ─── Constants ─── */
const EXAMPLE_PROMPTS = [
  'When NVDA drops more than 3% in a day, buy with 3x leverage. Stop loss 5%, take profit 15%.',
  'Long BTC when price dips below $60k with 2x leverage. Take profit at $70k, stop loss 5%.',
  'Short TSLA when Elon tweets something controversial. Use 3x leverage with 5% stop loss.',
  'Go long SOL on any positive Solana ecosystem news. Use 5x leverage with tight 3% stop loss.',
];

const UPSELL_PRICE = 50;

const GENESIS_LINES = [
  '[CORE] Compiling neural logic...',
  '[CORE] Allocating digital identity...',
  '[CORE] Scanning domain availability...',
  '[CORE] Agent Genesis complete.',
];

const TIER_THEME = {
  green: {
    border: 'border-cyber-green',
    bg: 'bg-cyber-green/5',
    text: 'text-cyber-green',
    glow: 'shadow-[0_0_20px_rgba(0,255,65,0.15)]',
  },
  blue: {
    border: 'border-cyber-blue',
    bg: 'bg-cyber-blue/5',
    text: 'text-cyber-blue',
    glow: 'shadow-[0_0_20px_rgba(0,212,255,0.15)]',
  },
  red: {
    border: 'border-cyber-red',
    bg: 'bg-cyber-red/5',
    text: 'text-cyber-red',
    glow: 'shadow-[0_0_20px_rgba(255,0,64,0.15)]',
  },
};

/* ─── Helpers ─── */
function generateTicker(name: string): string {
  const words = name.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  if (words.length <= 2) return words.join('').slice(0, 6).toUpperCase();
  return words.map((w) => w[0]).join('').slice(0, 6).toUpperCase();
}

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 20);
}

/* ─── Page ─── */
export default function CreateAgentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cloneId = searchParams.get('clone');
  const { address, chainId: currentChainId } = useAccount();
  const { refetchUser } = useUser();
  const { sendPayment, verifyAgentMint } = usePayment();
  const { balance: usdcBalance, isLoading: balanceLoading } = useUsdcBalance();
  const { fireGoldConfetti } = useConfetti();

  /* ── State ── */
  const [step, setStep] = useState<Step>('prompt');
  const [prompt, setPrompt] = useState('');
  const [parsedRules, setParsedRules] = useState<ParsedRules | null>(null);
  const [agentName, setAgentName] = useState('');
  const [ticker, setTicker] = useState('');
  const [domainSlug, setDomainSlug] = useState('');
  const [wantDomain, setWantDomain] = useState(false);
  const [wantLanding, setWantLanding] = useState(false);
  const [selectedTier, setSelectedTier] = useState<AgentTier>('sniper');
  const [selectedDataSources, setSelectedDataSources] = useState<Set<DataSourceId>>(
    () => new Set(DATA_SOURCES.filter(d => d.included).map(d => d.id))
  );
  const [mintAmount, setMintAmount] = useState(100);
  const [isLoading, setIsLoading] = useState(false);
  const [genesisLoading, setGenesisLoading] = useState(false);
  const [error, setError] = useState('');
  const [cloneSourceName, setCloneSourceName] = useState('');
  const t = useT();

  /* ── Derived ── */
  const tier = AGENT_TIERS[selectedTier];
  const dataCostPerDay = DATA_SOURCES
    .filter(d => selectedDataSources.has(d.id))
    .reduce((sum, d) => sum + d.cost_per_day, 0);
  const upsellCost = (wantDomain ? UPSELL_PRICE : 0) + (wantLanding ? UPSELL_PRICE : 0);
  const totalCost = mintAmount + upsellCost;
  const capitalAmount = mintAmount * (METABOLISM.CAPITAL_SPLIT_PCT / 100);
  const fuelUsd = mintAmount * (METABOLISM.ENERGY_SPLIT_PCT / 100) + upsellCost;
  const fuelPvp = fuelUsd * METABOLISM.PVP_PER_USD;
  const totalBurnPerDay = tier.pvp_per_day + (dataCostPerDay * METABOLISM.PVP_PER_USD);
  const lifespanDays = totalBurnPerDay > 0 ? fuelPvp / totalBurnPerDay : Infinity;

  const isOnBsc = currentChainId === 56;
  const hasEnoughUsdc = usdcBalance >= totalCost;
  const isDeploying = step === 'deploying';

  /* ── Genesis loading timer ── */
  useEffect(() => {
    if (!genesisLoading) return;
    const timer = setTimeout(() => setGenesisLoading(false), 2500);
    return () => clearTimeout(timer);
  }, [genesisLoading]);

  /* ── Clone pre-fill ── */
  useEffect(() => {
    if (!cloneId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/agent/${cloneId}`);
        const data = await res.json();
        if (cancelled || !data.success) return;
        const parent = data.data;
        setPrompt(parent.prompt);
        setCloneSourceName(parent.name);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [cloneId]);

  /* ── Handlers ── */
  const handleParseStrategy = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/agent/parse-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Failed to parse strategy');
        return;
      }
      const rules = data.data.parsedRules as ParsedRules;
      setParsedRules(rules);
      setAgentName(rules.name);
      setTicker(generateTicker(rules.name));
      setDomainSlug(generateSlug(rules.name));
      setGenesisLoading(true);
      setStep('genesis');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeploy = async () => {
    if (!parsedRules || !address) return;
    setIsLoading(true);
    setError('');
    setStep('deploying');
    try {
      const txHash = await sendPayment(56, totalCost);
      if (!txHash) {
        setError('Transaction failed or was rejected. Make sure you have enough USDC on BNB Chain.');
        setStep('deploy');
        setIsLoading(false);
        return;
      }
      // BSC confirms in ~3s, wait briefly then verify with retries
      await new Promise((r) => setTimeout(r, 2000));
      let result: { success: boolean; error?: string; data?: { agentId?: string } } = { success: false };
      for (let attempt = 0; attempt < 3; attempt++) {
        result = await verifyAgentMint(txHash, totalCost, {
          name: agentName,
          prompt,
          parsedRules: { ...parsedRules, tier: selectedTier, data_sources: Array.from(selectedDataSources) },
          avatarSeed: uuidv4(),
          cloneParentId: cloneId ?? undefined,
        });
        if (result.success) break;
        // Wait 2s before retry (tx might not be indexed yet)
        if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
      }
      if (!result.success) {
        setError(result.error || 'Failed to verify payment and mint agent');
        setStep('deploy');
        setIsLoading(false);
        return;
      }
      setStep('success');
      fireGoldConfetti();
      refetchUser();
      if (result.data?.agentId) {
        setTimeout(() => router.push(`/agent/${result.data!.agentId}`), 4000);
      }
    } catch {
      setError('Network error. Please try again.');
      setStep('deploy');
    } finally {
      setIsLoading(false);
    }
  };

  /* ── Step bar ── */
  const stepLabels = ['Prompt', 'Genesis', 'Package', 'Deploy'];
  const currentStepIndex =
    step === 'prompt' ? 0 :
    step === 'genesis' ? 1 :
    step === 'package' ? 2 :
    step === 'deploy' || step === 'deploying' ? 3 : 3;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-mono font-bold text-cyber-green uppercase tracking-wider">
          {'>'} Deploy AI Mercenary
        </h1>
        <p className="text-xs font-mono text-gray-500 mt-1">
          Describe your strategy. We handle the rest.
        </p>
      </div>

      {/* Step Progress */}
      {step !== 'deploying' && step !== 'success' && (
        <div className="flex items-center gap-2 text-xs font-mono">
          {stepLabels.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <span className={
                i === currentStepIndex ? 'text-cyber-green font-bold' :
                i < currentStepIndex ? 'text-cyber-green/50' : 'text-gray-600'
              }>
                [{String(i + 1).padStart(2, '0')}] {label.toUpperCase()}
              </span>
              {i < stepLabels.length - 1 && <span className="text-gray-700">{'>'}</span>}
            </div>
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* ═══════════════════════════════════════════
            STEP 1: PROMPT — ultra clean
        ═══════════════════════════════════════════ */}
        {step === 'prompt' && (
          <motion.div key="prompt" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">

            {/* Clone badge */}
            {cloneSourceName && (
              <div className="flex items-center gap-2 px-3 py-2 border border-cyber-purple/40 rounded bg-cyber-purple/5">
                <span className="text-[10px] font-mono text-cyber-purple uppercase tracking-wider">
                  Cloned from: <span className="text-gray-300 font-bold">{cloneSourceName}</span>
                </span>
              </div>
            )}

            {/* Giant terminal textarea */}
            <Card variant="terminal" className="!p-6">
              <label className="block text-sm font-mono text-cyber-green uppercase tracking-wider mb-4">
                {'>'} Describe your trading strategy...
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., Short TSLA when Elon tweets something controversial. Use 3x leverage with 5% stop loss. Take profit at 15%."
                className="w-full h-48 bg-transparent border-none outline-none resize-none font-mono text-sm text-cyber-green placeholder:text-gray-600 leading-relaxed"
                maxLength={2000}
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] font-mono text-gray-600">{prompt.length}/2000</span>
                <span className="text-[10px] font-mono text-gray-700">Free-form natural language</span>
              </div>
            </Card>

            {/* Example prompts */}
            {!prompt.trim() && (
              <div>
                <p className="text-xs font-mono text-gray-600 mb-2">{'// Quick templates — click to use:'}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {EXAMPLE_PROMPTS.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => setPrompt(ex)}
                      className="text-left p-3 border border-terminal-border rounded text-xs font-mono text-gray-500 hover:text-cyber-green hover:border-cyber-green/30 transition-colors"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="text-cyber-red font-mono text-xs">{error}</p>}

            {/* CTA */}
            <Button
              variant="primary"
              onClick={handleParseStrategy}
              loading={isLoading}
              disabled={!prompt.trim()}
              className="w-full !py-4 !text-sm"
            >
              {isLoading ? 'Analyzing Strategy...' : 'Analyze & Generate Identity'}
            </Button>

            {/* Parse animation */}
            {isLoading && (
              <Card variant="terminal" className="h-32">
                <TerminalText
                  lines={[
                    '[PARSE] Connecting to Claude AI...',
                    '[PARSE] Analyzing trading strategy...',
                    '[PARSE] Extracting trigger conditions...',
                    '[PARSE] Generating risk parameters...',
                    '[PARSE] Compiling agent rules...',
                  ]}
                  speed={80}
                />
              </Card>
            )}
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════
            STEP 2: GENESIS — identity + upsells
        ═══════════════════════════════════════════ */}
        {step === 'genesis' && parsedRules && (
          <motion.div key="genesis" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">

            {/* Genesis Loading Animation */}
            {genesisLoading ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-12"
              >
                <Card variant="terminal" className="h-48 flex items-center justify-center">
                  <div className="w-full">
                    <TerminalText lines={GENESIS_LINES} speed={60} />
                  </div>
                </Card>
                <div className="flex justify-center mt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-cyber-green rounded-full animate-pulse" />
                    <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">
                      Generating Agent Identity...
                    </span>
                    <div className="w-2 h-2 bg-cyber-green rounded-full animate-pulse" />
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="space-y-4"
              >
                {/* A. Parsed Strategy Summary */}
                <Card>
                  <h3 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider mb-2">
                    {'// Strategy Logic'}
                  </h3>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="green">{parsedRules.asset}</Badge>
                    <Badge variant={parsedRules.direction_bias === 'long' ? 'green' : parsedRules.direction_bias === 'short' ? 'red' : 'blue'}>
                      {parsedRules.direction_bias}
                    </Badge>
                    <span className="text-[10px] font-mono text-gray-600 ml-auto">{parsedRules.triggers.length} triggers detected</span>
                  </div>
                  <p className="text-xs font-mono text-gray-400">{parsedRules.description}</p>
                </Card>

                {/* B. Agent Identity (editable) */}
                <Card>
                  <h3 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider mb-3">
                    {'// Agent Identity'} <span className="text-gray-600 font-normal">— AI Generated, editable</span>
                  </h3>
                  <div className="flex gap-4">
                    <div className="flex-1 space-y-3">
                      <Input
                        label="Agent Name"
                        value={agentName}
                        onChange={(e) => setAgentName(e.target.value)}
                        placeholder="e.g., BTC Bear Hunter"
                      />
                      <Input
                        label="Ticker"
                        value={ticker}
                        onChange={(e) => setTicker(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                        placeholder="$BTCBH"
                      />
                    </div>
                    <div className="flex flex-col items-center gap-2 pt-5">
                      <div className="w-20 h-20 border-2 border-dashed border-terminal-border rounded-lg flex items-center justify-center bg-cyber-dark/50">
                        <span className="text-3xl">
                          {agentName ? agentName[0]?.toUpperCase() ?? '?' : '?'}
                        </span>
                      </div>
                      <button
                        className="text-[9px] font-mono text-cyber-purple hover:text-fuchsia-400 transition-colors uppercase tracking-wider"
                        onClick={() => {/* TODO: AI avatar generation */}}
                      >
                        Generate Avatar
                      </button>
                    </div>
                  </div>
                </Card>

                {/* C. Premium Upsell: Domain + Landing Page */}
                <Card className={wantDomain || wantLanding ? 'border-cyber-purple/40' : ''}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-lg">💎</span>
                    <h3 className="text-xs font-mono font-bold text-cyber-purple uppercase tracking-wider">
                      Premium Add-ons
                    </h3>
                  </div>

                  <div className="flex items-center gap-0 mb-4">
                    <input
                      value={domainSlug}
                      onChange={(e) => setDomainSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                      placeholder="yourslug"
                      className="flex-1 bg-cyber-dark border border-terminal-border border-r-0 rounded-l px-3 py-2 font-mono text-sm text-cyber-purple placeholder:text-gray-600 focus:outline-none focus:border-cyber-purple/50"
                    />
                    <div className="bg-cyber-dark/80 border border-terminal-border border-l-0 rounded-r px-3 py-2 font-mono text-sm text-gray-500">
                      .pvp.ai
                    </div>
                    <div className="flex items-center gap-1.5 ml-3 shrink-0">
                      <div className="w-2 h-2 rounded-full bg-cyber-green animate-pulse" />
                      <span className="text-[9px] font-mono text-cyber-green uppercase tracking-wider">Available</span>
                    </div>
                  </div>

                  <label className="flex items-start gap-2.5 cursor-pointer group mb-3">
                    <input
                      type="checkbox"
                      checked={wantDomain}
                      onChange={(e) => setWantDomain(e.target.checked)}
                      className="mt-0.5 accent-cyber-purple"
                    />
                    <span className="text-xs font-mono text-gray-400 group-hover:text-gray-300 transition-colors leading-relaxed">
                      Reserve this domain
                      <span className="text-cyber-gold ml-1">— {formatUsd(UPSELL_PRICE)} USDC</span>
                    </span>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={wantLanding}
                      onChange={(e) => setWantLanding(e.target.checked)}
                      className="mt-0.5 accent-cyber-purple"
                    />
                    <span className="text-xs font-mono text-gray-400 group-hover:text-gray-300 transition-colors leading-relaxed">
                      Generate Agent landing page (copy-trade referral page)
                      <span className="text-cyber-gold ml-1">— {formatUsd(UPSELL_PRICE)} USDC</span>
                    </span>
                  </label>

                  {(wantDomain || wantLanding) && domainSlug && (
                    <p className="text-[10px] font-mono text-cyber-purple/60 mt-3 pl-5">
                      Your agent will be live at https://{domainSlug}.pvp.ai
                    </p>
                  )}
                </Card>

                {/* Navigation */}
                <div className="flex gap-3">
                  <Button variant="ghost" onClick={() => setStep('prompt')} className="flex-1">
                    Back
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => setStep('package')}
                    disabled={!agentName.trim()}
                    className="flex-1"
                  >
                    Next — Select Package
                  </Button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════
            STEP 3: PACKAGE — tier selection
        ═══════════════════════════════════════════ */}
        {step === 'package' && parsedRules && (
          <motion.div key="package" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">

            <div>
              <h3 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider mb-3">
                {'// Select Package'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(Object.entries(AGENT_TIERS) as [AgentTier, typeof AGENT_TIERS[AgentTier]][]).map(([key, tc]) => {
                  const theme = TIER_THEME[tc.theme];
                  const isSelected = selectedTier === key;
                  const isDefault = key === 'sniper';

                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedTier(key)}
                      className={`relative p-4 border-2 rounded-lg text-left transition-all duration-200 ${
                        isSelected
                          ? `${theme.border} ${theme.bg} ${theme.glow}`
                          : 'border-terminal-border hover:border-gray-600'
                      }`}
                    >
                      {isDefault && (
                        <div className="absolute -top-2.5 left-3">
                          <span className="text-[9px] font-mono font-bold bg-cyber-blue text-black px-2 py-0.5 rounded uppercase">
                            Recommended
                          </span>
                        </div>
                      )}

                      <div className="text-2xl mb-2">{tc.icon}</div>
                      <h4 className={`text-sm font-mono font-bold uppercase tracking-wider ${isSelected ? theme.text : 'text-gray-300'}`}>
                        {tc.name}
                      </h4>
                      <p className="text-[10px] font-mono text-gray-500 mt-1 leading-relaxed">
                        {tc.tagline}
                      </p>

                      <div className="mt-3 pt-3 border-t border-terminal-border space-y-1.5 text-[10px] font-mono">
                        <div className="flex justify-between">
                          <span className="text-gray-600">AI</span>
                          <span className="text-gray-400">{tc.ai_label}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Compute</span>
                          <span className="text-gray-400">{tc.compute}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Frequency</span>
                          <span className="text-gray-400">{tc.frequency_label}</span>
                        </div>
                      </div>

                      <div className={`mt-3 pt-3 border-t border-terminal-border text-center ${isSelected ? theme.text : 'text-gray-400'}`}>
                        <p className="text-lg font-mono font-bold">{formatUsd(tc.pvp_per_day / METABOLISM.PVP_PER_USD)}</p>
                        <p className="text-[10px] font-mono text-gray-600">/day</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ─── Data Sources (separated from tier) ─── */}
            <Card>
              <h3 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider mb-1">
                {t.createAgent.dataSources}
              </h3>
              <p className="text-[10px] font-mono text-gray-600 mb-4">
                {t.createAgent.dataSourcesSubtitle}
              </p>

              <div className="space-y-2">
                {DATA_SOURCES.map((ds) => {
                  const isActive = selectedDataSources.has(ds.id);
                  const isFree = ds.cost_per_day === 0;

                  return (
                    <label
                      key={ds.id}
                      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                        isActive
                          ? isFree
                            ? 'border-cyber-green/30 bg-cyber-green/5'
                            : 'border-cyber-purple/40 bg-cyber-purple/5'
                          : 'border-terminal-border hover:border-gray-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isActive}
                        disabled={ds.included}
                        onChange={() => {
                          if (ds.included) return;
                          setSelectedDataSources((prev) => {
                            const next = new Set(prev);
                            if (next.has(ds.id)) next.delete(ds.id);
                            else next.add(ds.id);
                            return next;
                          });
                        }}
                        className="accent-cyber-purple shrink-0"
                      />
                      <span className="text-lg shrink-0">{ds.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-gray-300">{ds.name}</span>
                          {isFree && (
                            <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyber-green/15 text-cyber-green border border-cyber-green/30 uppercase">
                              {t.createAgent.dataFree}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-mono text-gray-600 mt-0.5">{ds.description}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        {isFree ? (
                          <span className="text-[10px] font-mono text-cyber-green">{t.createAgent.dataIncluded}</span>
                        ) : (
                          <span className="text-xs font-mono font-bold text-cyber-gold">
                            ${ds.cost_per_day}{t.createAgent.dataPerDay}
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>

              {dataCostPerDay > 0 && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-terminal-border">
                  <span className="text-[10px] font-mono text-gray-500 uppercase">{t.createAgent.dataCostLabel}</span>
                  <span className="text-xs font-mono font-bold text-cyber-gold">
                    +${dataCostPerDay}{t.createAgent.dataPerDay}
                  </span>
                </div>
              )}
            </Card>

            {/* Navigation */}
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setStep('genesis')} className="flex-1">
                Back
              </Button>
              <Button
                variant="primary"
                onClick={() => setStep('deploy')}
                className="flex-1"
              >
                Next — Fund & Deploy
              </Button>
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════
            STEP 4: DEPLOY — funding + vitals + deploy
        ═══════════════════════════════════════════ */}
        {(step === 'deploy' || step === 'deploying') && parsedRules && (
          <motion.div key="deploy" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">

            {/* Fund Agent Slider */}
            <Card>
              <h3 className="text-xs font-mono font-bold text-cyber-gold uppercase tracking-wider mb-3">
                {'// Fund Agent'}
              </h3>

              <div className="flex items-center justify-between mb-3 pb-3 border-b border-terminal-border">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isOnBsc ? 'bg-cyber-green' : 'bg-cyber-red animate-pulse'}`} />
                  <span className={`text-[10px] font-mono ${isOnBsc ? 'text-cyber-green' : 'text-cyber-red'}`}>
                    {isOnBsc ? 'BNB Chain' : 'Wrong Network'}
                  </span>
                </div>
                <span className="text-xs font-mono text-cyber-gold">
                  {balanceLoading ? '...' : `${formatUsd(usdcBalance)} USDC`}
                </span>
              </div>

              <input
                type="range"
                min={METABOLISM.MIN_MINT_USD}
                max={METABOLISM.MAX_MINT_USD}
                step={10}
                value={mintAmount}
                onChange={(e) => setMintAmount(Number(e.target.value))}
                className="w-full accent-cyber-green"
                disabled={isDeploying}
              />
              <div className="flex justify-between text-xs font-mono text-gray-500 mt-1">
                <span>${METABOLISM.MIN_MINT_USD}</span>
                <span className="text-cyber-gold font-bold">${mintAmount}</span>
                <span>${METABOLISM.MAX_MINT_USD}</span>
              </div>
              <div className="flex gap-2 mt-2">
                {[50, 100, 200, 500, 1000].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setMintAmount(amt)}
                    disabled={isDeploying}
                    className={`flex-1 py-1.5 text-xs font-mono border rounded transition-colors ${
                      mintAmount === amt
                        ? 'border-cyber-green text-cyber-green bg-cyber-green/10'
                        : 'border-terminal-border text-gray-500 hover:text-cyber-green hover:border-cyber-green/30'
                    }`}
                  >
                    ${amt}
                  </button>
                ))}
              </div>
            </Card>

            {/* Agent Vitals */}
            <NeonBorder color="green">
              <Card>
                <h3 className="text-sm font-mono font-bold text-cyber-green uppercase tracking-wider mb-3">
                  Agent Vitals
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-mono text-gray-600 uppercase mb-1">Capital (80%)</p>
                    <p className="text-lg font-bold text-cyber-gold">{formatUsd(capitalAmount)}</p>
                    <p className="text-[10px] font-mono text-gray-600">Trading ammo</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-mono text-gray-600 uppercase mb-1">Fuel (20%{upsellCost > 0 ? ' + Add-ons' : ''})</p>
                    <p className="text-lg font-bold text-fuchsia-400">{formatUsd(fuelUsd)}</p>
                    <p className="text-[10px] font-mono text-gray-600">Keeps agent alive</p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-terminal-border space-y-1 text-[10px] font-mono">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Package</span>
                    <span className="text-gray-300">{tier.icon} {tier.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Daily Burn (Tier)</span>
                    <span className="text-fuchsia-400">{formatFuel(tier.pvp_per_day)}/day</span>
                  </div>
                  {dataCostPerDay > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Daily Burn (Data)</span>
                      <span className="text-cyber-gold">+{formatUsd(dataCostPerDay)}/day</span>
                    </div>
                  )}
                  {wantDomain && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Domain</span>
                      <span className="text-cyber-purple">+{formatUsd(UPSELL_PRICE)}</span>
                    </div>
                  )}
                  {wantLanding && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Landing Page</span>
                      <span className="text-cyber-purple">+{formatUsd(UPSELL_PRICE)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1 border-t border-terminal-border text-xs font-bold">
                    <span className="text-gray-400">Estimated Lifespan</span>
                    <span className={lifespanDays < 2 ? 'text-red-500' : lifespanDays < 7 ? 'text-yellow-500' : 'text-cyber-green'}>
                      ~{lifespanDays.toFixed(1)} Days
                    </span>
                  </div>
                </div>

                {/* Lifespan bar */}
                <div className="w-full h-2 bg-gray-800 rounded-full mt-2">
                  <div
                    className={`h-full rounded-full transition-all ${
                      lifespanDays < 2 ? 'bg-red-500' :
                      lifespanDays < 7 ? 'bg-gradient-to-r from-yellow-500 to-cyber-green' :
                      'bg-gradient-to-r from-fuchsia-500 to-cyber-green'
                    }`}
                    style={{ width: `${Math.min(100, (lifespanDays / 30) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] font-mono text-gray-700 mt-1">
                  Profitable trades extend lifespan via vampire feedback (10% profit &#8594; fuel)
                </p>
              </Card>
            </NeonBorder>

            {/* Warnings */}
            {!hasEnoughUsdc && !balanceLoading && (
              <Card className="border-cyber-gold/30">
                <p className="text-cyber-gold font-mono text-xs">
                  ! Wallet has {formatUsd(usdcBalance)} USDC — need {formatUsd(totalCost)}. Top up on BNB Chain before deploying.
                </p>
              </Card>
            )}

            {error && (
              <Card className="border-cyber-red/30">
                <p className="text-cyber-red font-mono text-xs">! {error}</p>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setStep('package')} className="flex-1" disabled={isDeploying}>
                Back
              </Button>
              <Button
                variant="primary"
                onClick={handleDeploy}
                loading={isDeploying}
                disabled={!agentName.trim() || mintAmount < METABOLISM.MIN_MINT_USD || isDeploying}
                className="flex-1"
              >
                {isDeploying ? 'Deploying...' : `Deploy Agent — ${formatUsd(totalCost)}`}
              </Button>
            </div>

            {isDeploying && (
              <Card variant="terminal" className="h-24">
                <TerminalText lines={['[PAY] Switching to BNB Chain...', '[PAY] Sending USDC on BNB Chain...', '[PAY] Waiting for on-chain confirmation...', '[MINT] Verifying payment and creating agent...']} speed={100} />
              </Card>
            )}
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════
            SUCCESS
        ═══════════════════════════════════════════ */}
        {step === 'success' && (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-12">
            <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="text-6xl mb-4">
              {tier.icon}
            </motion.div>
            <h2 className="text-2xl font-mono font-bold text-cyber-green neon-glow-strong uppercase tracking-wider mb-2">
              Agent Deployed!
            </h2>
            <p className="text-gray-500 font-mono text-sm mb-1">
              {agentName}{ticker ? ` ($${ticker})` : ''} is now alive and hunting...
            </p>
            <div className="flex items-center justify-center gap-4 text-xs font-mono mt-3 flex-wrap">
              <span className="text-cyber-gold">{formatUsd(capitalAmount)} capital</span>
              <span className="text-gray-600">|</span>
              <span className="text-fuchsia-400">{formatUsd(fuelUsd)} fuel</span>
              <span className="text-gray-600">|</span>
              <span className="text-cyber-green">~{lifespanDays.toFixed(1)}d</span>
              <span className="text-gray-600">|</span>
              <span className="text-cyber-blue">{tier.name}</span>
            </div>
            <Card variant="terminal" className="mt-6 h-40 text-left">
              <TerminalText
                lines={[
                  `[BOOT] Initializing ${agentName}${ticker ? ` $${ticker}` : ''}...`,
                  `[TIER] Package: ${tier.name}`,
                  `[BRAIN] AI: ${tier.ai_label} | Compute: ${tier.compute}`,
                  `[DATA] Feeds: ${DATA_SOURCES.filter(d => selectedDataSources.has(d.id)).map(d => d.name).join(', ')}`,
                  `[FUEL] ${formatUsd(fuelUsd)} | Burn: ${formatUsd(totalBurnPerDay / METABOLISM.PVP_PER_USD)}/day`,
                  `[AMMO] Capital: ${formatUsd(capitalAmount)}`,
                  ...(wantDomain && domainSlug ? [`[WEB] Registering ${domainSlug}.pvp.ai...`] : []),
                  ...(wantLanding ? ['[WEB] Generating landing page...'] : []),
                  '[BOOT] Connecting to Hyperliquid...',
                  `[SCAN] Agent online. Hunting for ${parsedRules?.asset?.replace('xyz:', '') ?? 'market'} opportunities...`,
                ]}
                speed={50}
              />
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
