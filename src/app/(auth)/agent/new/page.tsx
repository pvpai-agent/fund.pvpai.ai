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

/* ─── Avatar Styles (DiceBear) ─── */
const AVATAR_STYLES = ['bottts', 'identicon', 'shapes', 'pixel-art', 'thumbs', 'rings'] as const;
function diceBearUrl(style: string, seed: string): string {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}&size=160`;
}

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
  const reconfigureId = searchParams.get('reconfigure');
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
  const [revenueSplit, setRevenueSplit] = useState({ lp_pct: 80, agent_pct: 10, creator_pct: 10 });
  const [isLoading, setIsLoading] = useState(false);
  const [genesisLoading, setGenesisLoading] = useState(false);
  const [error, setError] = useState('');
  const [cloneSourceName, setCloneSourceName] = useState('');
  const [avatarStyleIdx, setAvatarStyleIdx] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null); // custom upload (data URL) or null = use DiceBear
  const t = useT();

  /* ── Derived ── */
  const tier = AGENT_TIERS[selectedTier];
  // Orbit presale: one-time cost, NOT daily burn
  const orbitDs = DATA_SOURCES.find(d => d.id === 'orbit_space');
  const orbitIsPresale = orbitDs?.presale?.enabled ?? false;
  const orbitPresalePrice = orbitIsPresale ? (orbitDs?.presale?.price_usdc ?? 0) : 0;
  const orbitSelected = selectedDataSources.has('orbit_space');
  // Daily data costs: exclude Orbit entirely when presale (no daily burn impact)
  const dataCostPerDay = DATA_SOURCES
    .filter(d => selectedDataSources.has(d.id) && !(d.id === 'orbit_space' && orbitIsPresale))
    .reduce((sum, d) => sum + d.cost_per_day, 0);
  // Data sources cost excluding Orbit (shown separately in vitals)
  const dataFeedCostOnly = DATA_SOURCES
    .filter(d => selectedDataSources.has(d.id) && d.id !== 'orbit_space')
    .reduce((sum, d) => sum + d.cost_per_day, 0);
  const orbitCostPerDay = orbitSelected && !orbitIsPresale ? (orbitDs?.cost_per_day ?? 0) : 0;
  const orbitPresaleCost = orbitSelected && orbitIsPresale ? orbitPresalePrice : 0;
  const upsellCost = (wantDomain ? UPSELL_PRICE : 0) + (wantLanding ? UPSELL_PRICE : 0) + orbitPresaleCost;
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

  /* ── Reconfigure pre-fill — loads existing agent into package step ── */
  useEffect(() => {
    if (!reconfigureId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/agent/${reconfigureId}`);
        const data = await res.json();
        if (cancelled || !data.success) return;
        const a = data.data;
        setPrompt(a.prompt);
        setAgentName(a.name);
        setTicker(generateTicker(a.name));
        setDomainSlug(generateSlug(a.name));
        setParsedRules(a.parsed_rules);
        const agentTier = (a.parsed_rules?.tier ?? 'sniper') as AgentTier;
        setSelectedTier(agentTier);
        if (a.parsed_rules?.data_sources) {
          setSelectedDataSources(new Set(a.parsed_rules.data_sources as DataSourceId[]));
        }
        if (a.parsed_rules?.revenue_split) {
          setRevenueSplit(a.parsed_rules.revenue_split);
        }
        setStep('package');
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [reconfigureId]);

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
        const seed = uuidv4();
        result = await verifyAgentMint(txHash, totalCost, {
          name: agentName,
          prompt,
          parsedRules: { ...parsedRules, tier: selectedTier, data_sources: Array.from(selectedDataSources), revenue_split: revenueSplit },
          avatarSeed: seed,
          avatarUrl: avatarUrl ?? diceBearUrl(AVATAR_STYLES[avatarStyleIdx], agentName || seed),
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

  const handleReconfigure = async () => {
    if (!parsedRules || !reconfigureId) return;
    setIsLoading(true);
    setError('');
    setStep('deploying');
    try {
      const res = await fetch(`/api/agent/${reconfigureId}/strategy`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          parsedRules: { ...parsedRules, tier: selectedTier, data_sources: Array.from(selectedDataSources), revenue_split: revenueSplit },
        }),
      });
      const result = await res.json();
      if (!result.success) {
        setError(result.error || 'Failed to update strategy');
        setStep('deploy');
        setIsLoading(false);
        return;
      }
      setStep('success');
      fireGoldConfetti();
      setTimeout(() => router.push(`/agent/${reconfigureId}`), 3000);
    } catch {
      setError('Network error. Please try again.');
      setStep('deploy');
    } finally {
      setIsLoading(false);
    }
  };

  /* ── Step bar ── */
  const stepLabels = [t.createAgent.stepPrompt, t.createAgent.stepGenesis, t.createAgent.stepPackage, t.createAgent.stepDeploy];
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
          {t.createAgent.title}
        </h1>
        <p className="text-xs font-mono text-gray-500 mt-1">
          {t.createAgent.subtitle}
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
                  {t.createAgent.clonedFrom} <span className="text-gray-300 font-bold">{cloneSourceName}</span>
                </span>
              </div>
            )}

            {/* Giant terminal textarea */}
            <Card variant="terminal" className="!p-6">
              <label className="block text-sm font-mono text-cyber-green uppercase tracking-wider mb-4">
                {t.createAgent.promptLabel}
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t.createAgent.promptPlaceholder}
                className="w-full h-48 bg-transparent border-none outline-none resize-none font-mono text-sm text-cyber-green placeholder:text-gray-600 leading-relaxed"
                maxLength={2000}
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] font-mono text-gray-600">{prompt.length}/2000</span>
                <span className="text-[10px] font-mono text-gray-700">{t.createAgent.promptHint}</span>
              </div>
            </Card>

            {/* Example prompts */}
            {!prompt.trim() && (
              <div>
                <p className="text-xs font-mono text-gray-600 mb-2">{t.createAgent.quickTemplates}</p>
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
              {isLoading ? t.createAgent.analyzing : t.createAgent.analyzeBtn}
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
                      {t.createAgent.generatingIdentity}
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
                    {t.createAgent.strategyLogic}
                  </h3>
                  <div className="flex items-center gap-2 mb-2">
                    {parsedRules.assets.map((a) => (
                      <Badge key={a} variant="green">{a.replace('xyz:', '')}</Badge>
                    ))}
                    <Badge variant={parsedRules.direction_bias === 'long' ? 'green' : parsedRules.direction_bias === 'short' ? 'red' : 'blue'}>
                      {parsedRules.direction_bias}
                    </Badge>
                    <span className="text-[10px] font-mono text-gray-600 ml-auto">{parsedRules.triggers.length} {t.createAgent.triggersDetected}</span>
                  </div>
                  <p className="text-xs font-mono text-gray-400">{parsedRules.description}</p>
                </Card>

                {/* B. Agent Identity (editable) */}
                <Card>
                  <h3 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider mb-3">
                    {t.createAgent.agentIdentity} <span className="text-gray-600 font-normal">{t.createAgent.aiGenerated}</span>
                  </h3>
                  <div className="flex gap-4">
                    <div className="flex-1 space-y-3">
                      <Input
                        label={t.createAgent.agentName}
                        value={agentName}
                        onChange={(e) => setAgentName(e.target.value)}
                        placeholder={t.createAgent.agentNamePlaceholder}
                      />
                      <Input
                        label={t.createAgent.ticker}
                        value={ticker}
                        onChange={(e) => setTicker(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                        placeholder="$BTCBH"
                      />
                    </div>
                    <div className="flex flex-col items-center gap-2 pt-5">
                      <div className="w-20 h-20 border-2 border-terminal-border rounded-lg overflow-hidden bg-cyber-dark/50 relative group">
                        {avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                        ) : agentName ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={diceBearUrl(AVATAR_STYLES[avatarStyleIdx], agentName)}
                            alt="avatar"
                            className="w-full h-full"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-terminal-border">
                            <span className="text-3xl text-gray-600">?</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="text-[9px] font-mono text-cyber-purple hover:text-fuchsia-400 transition-colors uppercase tracking-wider"
                          onClick={() => {
                            setAvatarUrl(null);
                            setAvatarStyleIdx((i) => (i + 1) % AVATAR_STYLES.length);
                          }}
                        >
                          {t.createAgent.generateAvatar}
                        </button>
                        <span className="text-gray-700 text-[9px]">|</span>
                        <label className="text-[9px] font-mono text-cyber-blue hover:text-cyan-400 transition-colors uppercase tracking-wider cursor-pointer">
                          {t.createAgent.uploadAvatar ?? 'UPLOAD'}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > 5 * 1024 * 1024) {
                                setError('Avatar must be under 5MB');
                                return;
                              }
                              // Compress and resize to 256x256 JPEG
                              const img = new Image();
                              img.onload = () => {
                                const canvas = document.createElement('canvas');
                                const size = 256;
                                canvas.width = size;
                                canvas.height = size;
                                const ctx = canvas.getContext('2d')!;
                                // Center-crop to square
                                const minDim = Math.min(img.width, img.height);
                                const sx = (img.width - minDim) / 2;
                                const sy = (img.height - minDim) / 2;
                                ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
                                const compressed = canvas.toDataURL('image/jpeg', 0.8);
                                setAvatarUrl(compressed);
                                URL.revokeObjectURL(img.src);
                              };
                              img.src = URL.createObjectURL(file);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* C. Premium Upsell: Domain + Landing Page */}
                <Card className={wantDomain || wantLanding ? 'border-cyber-purple/40' : ''}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-lg">💎</span>
                    <h3 className="text-xs font-mono font-bold text-cyber-purple uppercase tracking-wider">
                      {t.createAgent.premiumAddons}
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
                      .pvpai.ai
                    </div>
                    <div className="flex items-center gap-1.5 ml-3 shrink-0">
                      <div className="w-2 h-2 rounded-full bg-cyber-green animate-pulse" />
                      <span className="text-[9px] font-mono text-cyber-green uppercase tracking-wider">{t.createAgent.available}</span>
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
                      {t.createAgent.reserveDomain}
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
                    <div className="text-xs font-mono text-gray-400 group-hover:text-gray-300 transition-colors leading-relaxed">
                      {t.createAgent.agentHomepage}
                      <span className="text-cyber-gold ml-1">— {formatUsd(UPSELL_PRICE)} USDC</span>
                      <p className="text-[10px] text-gray-600 mt-0.5">
                        {t.createAgent.agentHomepageDesc}
                      </p>
                    </div>
                  </label>

                  {(wantDomain || wantLanding) && domainSlug && (
                    <p className="text-[10px] font-mono text-cyber-purple/60 mt-3 pl-5">
                      {t.createAgent.liveAt} https://{domainSlug}.pvpai.ai → {t.createAgent.linksTo} pvpai.ai/agent/[id]
                    </p>
                  )}
                </Card>

                {/* Navigation */}
                <div className="flex gap-3">
                  <Button variant="ghost" onClick={() => setStep('prompt')} className="flex-1">
                    {t.createAgent.back}
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => setStep('package')}
                    disabled={!agentName.trim()}
                    className="flex-1"
                  >
                    {t.createAgent.nextPackage}
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
                {t.createAgent.runtime}
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
                            {t.createAgent.recommended}
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
                          <span className="text-gray-600">{t.upgradeModal.aiModel}</span>
                          <span className="text-gray-400">{tc.ai_label}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">{t.upgradeModal.compute}</span>
                          <span className="text-gray-400">{tc.compute}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">{t.upgradeModal.frequency}</span>
                          <span className="text-gray-400">{tc.frequency_label}</span>
                        </div>
                      </div>

                      <div className={`mt-3 pt-3 border-t border-terminal-border text-center ${isSelected ? theme.text : 'text-gray-400'}`}>
                        <p className="text-lg font-mono font-bold">{formatUsd(tc.pvp_per_day / METABOLISM.PVP_PER_USD)}</p>
                        <p className="text-[10px] font-mono text-gray-600">{t.agent.perDay}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ─── Orbit AI Space Cloud — Presale Pre-purchase ─── */}
            {(() => {
              const orbitDs = DATA_SOURCES.find(d => d.id === 'orbit_space');
              if (!orbitDs) return null;
              const orbitActive = selectedDataSources.has('orbit_space');
              const presale = orbitDs.presale;
              return (
                <label
                  className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    orbitActive
                      ? 'border-fuchsia-500/60 bg-gradient-to-r from-fuchsia-500/10 via-cyber-purple/10 to-cyber-blue/10 shadow-[0_0_20px_rgba(236,72,153,0.2)]'
                      : 'border-fuchsia-500/25 bg-gradient-to-r from-fuchsia-500/5 via-transparent to-cyber-blue/5 hover:border-fuchsia-500/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={orbitActive}
                      onChange={() => {
                        setSelectedDataSources((prev) => {
                          const next = new Set(prev);
                          if (next.has('orbit_space')) next.delete('orbit_space');
                          else next.add('orbit_space');
                          return next;
                        });
                      }}
                      className="accent-fuchsia-500 shrink-0"
                    />
                    <span className="text-2xl shrink-0">🛰️</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-mono font-bold text-fuchsia-400">Orbit AI Space Cloud Node</span>
                        <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-fuchsia-500/15 text-fuchsia-400 border border-fuchsia-500/30 uppercase animate-pulse">
                          {t.createAgent.orbitUltimate}
                        </span>
                        {presale?.enabled && (
                          <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyber-gold/15 text-cyber-gold border border-cyber-gold/30 uppercase animate-pulse">
                            🔥 {t.createAgent.orbitPresale}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-mono text-gray-500 mt-1 leading-relaxed">
                        {t.createAgent.orbitDesc}
                      </p>
                      {presale?.enabled && (
                        <p className="text-[10px] font-mono text-cyber-gold/80 mt-1">
                          {t.createAgent.orbitPresaleDesc}
                        </p>
                      )}
                      <a
                        href="https://www.orbitai.global/"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[10px] font-mono text-fuchsia-400/70 hover:text-fuchsia-400 mt-1 transition-colors"
                      >
                        orbitai.global {'\u2197'}
                      </a>
                    </div>
                    <div className="shrink-0 text-right">
                      {presale?.enabled ? (
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-mono text-gray-600 line-through">
                            ${orbitDs.original_cost_per_day}{t.createAgent.dataPerDay}
                          </span>
                          <span className="text-sm font-mono font-bold text-cyber-gold">
                            ${presale.price_usdc} USDC
                          </span>
                          <span className="text-[9px] font-mono text-fuchsia-400/70 mt-0.5">
                            {t.createAgent.orbitPresaleIncludes}
                          </span>
                          <span className="text-[8px] font-mono text-gray-600 mt-0.5">
                            {t.createAgent.orbitPresaleLaunch}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm font-mono font-bold text-fuchsia-400">
                          ${orbitDs.cost_per_day}{t.createAgent.dataPerDay}
                        </span>
                      )}
                    </div>
                  </div>
                </label>
              );
            })()}

            {/* ─── Data Sources (collapsible) ─── */}
            <details className="group rounded-lg border border-terminal-border bg-cyber-dark">
              <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none list-none">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider">
                    {'// PVPAI OS'} {t.createAgent.dataSources}
                  </span>
                  <span className="text-[9px] font-mono text-gray-600 group-open:hidden">[+]</span>
                  <span className="text-[9px] font-mono text-gray-600 hidden group-open:inline">[-]</span>
                </div>
                {dataFeedCostOnly > 0 && (
                  <span className="text-[10px] font-mono font-bold text-cyber-gold">
                    +${dataFeedCostOnly}{t.createAgent.dataPerDay}
                  </span>
                )}
              </summary>
              <div className="px-4 pb-4 space-y-2">
                <p className="text-[10px] font-mono text-gray-600 mb-2">
                  {t.createAgent.dataSourcesSubtitle}
                </p>
                {DATA_SOURCES.filter(ds => ds.id !== 'orbit_space').map((ds) => {
                  const isActive = selectedDataSources.has(ds.id);
                  const hasPromo = ds.original_cost_per_day > ds.cost_per_day;

                  return (
                    <label
                      key={ds.id}
                      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                        isActive
                          ? 'border-cyber-green/40 bg-cyber-green/5'
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
                          {hasPromo && (
                            <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyber-green/15 text-cyber-green border border-cyber-green/30 uppercase animate-pulse">
                              🔥 {t.createAgent.dataPromo}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-mono text-gray-600 mt-0.5">{ds.description}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        {hasPromo ? (
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] font-mono text-gray-600 line-through">
                              ${ds.original_cost_per_day}{t.createAgent.dataPerDay}
                            </span>
                            <span className="text-xs font-mono font-bold text-cyber-green">
                              {ds.cost_per_day === 0 ? t.createAgent.dataFree : `$${ds.cost_per_day}${t.createAgent.dataPerDay}`}
                            </span>
                          </div>
                        ) : ds.cost_per_day === 0 ? (
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
            </details>

            {/* Navigation */}
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setStep('genesis')} className="flex-1">
                {t.createAgent.back}
              </Button>
              <Button
                variant="primary"
                onClick={() => setStep('deploy')}
                className="flex-1"
              >
                {t.createAgent.nextDeploy}
              </Button>
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════
            STEP 4: DEPLOY — funding + vitals + deploy
        ═══════════════════════════════════════════ */}
        {(step === 'deploy' || step === 'deploying') && parsedRules && (
          <motion.div key="deploy" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">

            {/* Fund Agent Slider (hidden during reconfigure — no new payment needed) */}
            {!reconfigureId && <Card>
              <h3 className="text-xs font-mono font-bold text-cyber-gold uppercase tracking-wider mb-3">
                {t.createAgent.fundAgent}
              </h3>

              <div className="flex items-center justify-between mb-3 pb-3 border-b border-terminal-border">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isOnBsc ? 'bg-cyber-green' : 'bg-cyber-red animate-pulse'}`} />
                  <span className={`text-[10px] font-mono ${isOnBsc ? 'text-cyber-green' : 'text-cyber-red'}`}>
                    {isOnBsc ? 'BNB Chain' : t.createAgent.wrongNetwork}
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
            </Card>}

            {/* ─── Revenue Split ─── */}
            <Card>
              <h3 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider mb-3">
                {'// '}{t.createAgent.revenueSplit}
              </h3>
              <p className="text-[10px] font-mono text-gray-600 mb-4">
                {t.createAgent.revenueSplitDesc}
              </p>

              <div className="space-y-4">
                {/* LP Investors */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-cyber-gold">{t.createAgent.lpInvestors}</span>
                    <span className="text-sm font-mono font-bold text-cyber-gold">{revenueSplit.lp_pct}%</span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={95}
                    step={5}
                    value={revenueSplit.lp_pct}
                    onChange={(e) => {
                      const lp = Number(e.target.value);
                      const remaining = 100 - lp;
                      const agentRatio = revenueSplit.agent_pct / (revenueSplit.agent_pct + revenueSplit.creator_pct || 1);
                      let agent = Math.round(remaining * agentRatio / 5) * 5;
                      let creator = remaining - agent;
                      if (agent < 0) { agent = 0; creator = remaining; }
                      if (creator < 0) { creator = 0; agent = remaining; }
                      setRevenueSplit({ lp_pct: lp, agent_pct: agent, creator_pct: creator });
                    }}
                    className="w-full accent-cyber-gold"
                    disabled={isDeploying}
                  />
                </div>

                {/* Agent Treasury */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-cyber-blue">{t.createAgent.agentTreasury}</span>
                    <span className="text-sm font-mono font-bold text-cyber-blue">{revenueSplit.agent_pct}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100 - revenueSplit.lp_pct}
                    step={5}
                    value={revenueSplit.agent_pct}
                    onChange={(e) => {
                      const agent = Number(e.target.value);
                      const creator = 100 - revenueSplit.lp_pct - agent;
                      if (creator < 0) return;
                      setRevenueSplit({ ...revenueSplit, agent_pct: agent, creator_pct: creator });
                    }}
                    className="w-full accent-cyber-blue"
                    disabled={isDeploying}
                  />
                </div>

                {/* Creator Fee */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-fuchsia-400">{t.createAgent.creatorFee}</span>
                    <span className="text-sm font-mono font-bold text-fuchsia-400">{revenueSplit.creator_pct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-800 rounded-full">
                    <div className="h-full rounded-full bg-fuchsia-500/50" style={{ width: `${revenueSplit.creator_pct}%` }} />
                  </div>
                  <p className="text-[9px] font-mono text-gray-600 mt-1">{t.createAgent.creatorFeeAuto}</p>
                </div>
              </div>

              {/* Visual bar */}
              <div className="flex h-3 rounded-full overflow-hidden mt-4 border border-terminal-border">
                <div className="bg-cyber-gold/40" style={{ width: `${revenueSplit.lp_pct}%` }} />
                <div className="bg-cyber-blue/40" style={{ width: `${revenueSplit.agent_pct}%` }} />
                <div className="bg-fuchsia-500/40" style={{ width: `${revenueSplit.creator_pct}%` }} />
              </div>
              <div className="flex justify-between text-[8px] font-mono text-gray-600 mt-1">
                <span>{t.createAgent.lpInvestors} {revenueSplit.lp_pct}%</span>
                <span>{t.createAgent.agentTreasury} {revenueSplit.agent_pct}%</span>
                <span>{t.createAgent.creatorFee} {revenueSplit.creator_pct}%</span>
              </div>
            </Card>

            {/* Agent Vitals */}
            <NeonBorder color="green">
              <Card>
                <h3 className="text-sm font-mono font-bold text-cyber-green uppercase tracking-wider mb-3">
                  {t.createAgent.agentVitals}
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-mono text-gray-600 uppercase mb-1">{t.createAgent.capitalLabel}</p>
                    <p className="text-lg font-bold text-cyber-gold">{formatUsd(capitalAmount)}</p>
                    <p className="text-[10px] font-mono text-gray-600">{t.createAgent.tradingAmmo}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-mono text-gray-600 uppercase mb-1">{t.createAgent.fuelLabel}{upsellCost > 0 ? ` ${t.createAgent.addons}` : ''}</p>
                    <p className="text-lg font-bold text-fuchsia-400">{formatUsd(fuelUsd)}</p>
                    <p className="text-[10px] font-mono text-gray-600">{t.createAgent.keepsAlive}</p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-terminal-border space-y-1 text-[10px] font-mono">
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t.createAgent.package}</span>
                    <span className="text-gray-300">{tier.icon} {tier.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t.createAgent.dailyBurnTier}</span>
                    <span className="text-fuchsia-400">{formatFuel(tier.pvp_per_day)}{t.agent.perDay}</span>
                  </div>
                  {DATA_SOURCES.filter(ds => !ds.included && selectedDataSources.has(ds.id)).map(ds => {
                    const isPromo = ds.original_cost_per_day > ds.cost_per_day;
                    const isOrbit = ds.id === 'orbit_space';
                    const isPresale = isOrbit && ds.presale?.enabled;
                    return (
                      <div key={ds.id} className="flex justify-between">
                        <span className="text-gray-600">{ds.icon} {ds.name}</span>
                        {isPresale ? (
                          <span className="text-fuchsia-400">
                            ${ds.presale!.price_usdc} USDC <span className="text-[8px] text-gray-500">({t.createAgent.orbitPresale})</span>
                          </span>
                        ) : isPromo ? (
                          <span className="text-cyber-green">
                            <span className="line-through text-gray-600 mr-1">${ds.original_cost_per_day}{t.agent.perDay}</span>
                            ${ds.cost_per_day}{t.agent.perDay}
                          </span>
                        ) : (
                          <span className={isOrbit ? 'text-fuchsia-400' : 'text-cyber-gold'}>
                            +{formatUsd(ds.cost_per_day)}{t.agent.perDay}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {wantDomain && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t.createAgent.domain}</span>
                      <span className="text-cyber-purple">+{formatUsd(UPSELL_PRICE)}</span>
                    </div>
                  )}
                  {wantLanding && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t.createAgent.agentHomepage}</span>
                      <span className="text-cyber-purple">+{formatUsd(UPSELL_PRICE)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t.createAgent.revenueSplit}</span>
                    <span className="text-gray-300">
                      <span className="text-cyber-gold">{revenueSplit.lp_pct}%</span>
                      {' / '}
                      <span className="text-cyber-blue">{revenueSplit.agent_pct}%</span>
                      {' / '}
                      <span className="text-fuchsia-400">{revenueSplit.creator_pct}%</span>
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-terminal-border text-xs font-bold">
                    <span className="text-gray-400">{t.createAgent.estLifespan}</span>
                    <span className={lifespanDays < 2 ? 'text-red-500' : lifespanDays < 7 ? 'text-yellow-500' : 'text-cyber-green'}>
                      ~{lifespanDays.toFixed(1)} {t.createAgent.days}
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
                  {t.createAgent.vampireNote}
                </p>
              </Card>
            </NeonBorder>

            {/* Warnings */}
            {!reconfigureId && !hasEnoughUsdc && !balanceLoading && (
              <Card className="border-cyber-gold/30">
                <p className="text-cyber-gold font-mono text-xs">
                  ! {t.createAgent.walletNeedDeploy.replace('{balance}', formatUsd(usdcBalance)).replace('{need}', formatUsd(totalCost))}
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
                {t.createAgent.back}
              </Button>
              {reconfigureId ? (
                <Button
                  variant="primary"
                  onClick={handleReconfigure}
                  loading={isDeploying}
                  disabled={!agentName.trim() || isDeploying}
                  className="flex-1"
                >
                  {isDeploying ? t.createAgent.saving : t.createAgent.saveStrategy}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={handleDeploy}
                  loading={isDeploying}
                  disabled={!agentName.trim() || mintAmount < METABOLISM.MIN_MINT_USD || isDeploying}
                  className="flex-1"
                >
                  {isDeploying ? t.createAgent.deploying : t.createAgent.deployBtn.replace('{cost}', formatUsd(totalCost))}
                </Button>
              )}
            </div>

            {isDeploying && (
              <Card variant="terminal" className="h-24">
                <TerminalText lines={reconfigureId
                  ? ['[RECONFIG] Updating strategy...', '[RECONFIG] Saving new parsed rules...', '[RECONFIG] Recording version history...', '[RECONFIG] Strategy updated!']
                  : ['[PAY] Switching to BNB Chain...', '[PAY] Sending USDC on BNB Chain...', '[PAY] Waiting for on-chain confirmation...', '[MINT] Verifying payment and creating agent...']} speed={100} />
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
              {t.createAgent.successTitle}
            </h2>
            <p className="text-gray-500 font-mono text-sm mb-1">
              {agentName}{ticker ? ` ($${ticker})` : ''} {t.createAgent.successHunting}
            </p>
            <div className="flex items-center justify-center gap-4 text-xs font-mono mt-3 flex-wrap">
              <span className="text-cyber-gold">{formatUsd(capitalAmount)} {t.createAgent.capital}</span>
              <span className="text-gray-600">|</span>
              <span className="text-fuchsia-400">{formatUsd(fuelUsd)} {t.createAgent.fuel}</span>
              <span className="text-gray-600">|</span>
              <span className="text-cyber-green">~{lifespanDays.toFixed(1)}d</span>
              <span className="text-gray-600">|</span>
              <span className="text-cyber-blue">{tier.name}</span>
            </div>
            <Card variant="terminal" className="mt-6 h-40 text-left">
              <TerminalText
                lines={[
                  `[PVPAI OS] Initializing ${agentName}${ticker ? ` $${ticker}` : ''}...`,
                  `[TIER] Package: ${tier.name}`,
                  `[BRAIN] AI: ${tier.ai_label} | Compute: ${tier.compute}`,
                  `[DATA] Feeds: ${DATA_SOURCES.filter(d => selectedDataSources.has(d.id)).map(d => d.name).join(', ')}`,
                  `[FUEL] ${formatUsd(fuelUsd)} | Burn: ${formatUsd(totalBurnPerDay / METABOLISM.PVP_PER_USD)}/day`,
                  `[AMMO] Capital: ${formatUsd(capitalAmount)}`,
                  ...(wantDomain && domainSlug ? [`[WEB] Registering ${domainSlug}.pvpai.ai...`] : []),
                  ...(wantLanding ? ['[WEB] Generating Agent Homepage...'] : []),
                  '[BOOT] Connecting to Hyperliquid...',
                  `[SCAN] Agent online. Hunting for ${parsedRules?.assets?.map(a => a.replace('xyz:', '')).join(', ') ?? 'market'} opportunities...`,
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
