'use client';

import type { ParsedRules } from '@/types/database';

interface StrategyDiffProps {
  currentRules: ParsedRules;
  proposedRules: ParsedRules;
}

function DiffLine({ label, current, proposed }: { label: string; current: string; proposed: string }) {
  const changed = current !== proposed;
  if (!changed) return null;

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] text-gray-600 uppercase">{label}</span>
      <div className="flex items-center gap-2 text-[10px] font-mono">
        <span className="text-cyber-red line-through">{current}</span>
        <span className="text-gray-600">{'->'}</span>
        <span className="text-cyber-green">{proposed}</span>
      </div>
    </div>
  );
}

export function StrategyDiff({ currentRules, proposedRules }: StrategyDiffProps) {
  return (
    <div className="bg-cyber-darker/50 rounded border border-terminal-border p-2 space-y-1.5">
      <div className="text-[9px] font-mono text-cyber-gold uppercase tracking-wider">
        Strategy Override Proposal
      </div>

      <DiffLine
        label="Direction"
        current={currentRules.direction_bias}
        proposed={proposedRules.direction_bias}
      />
      <DiffLine
        label="Description"
        current={currentRules.description}
        proposed={proposedRules.description}
      />
      <DiffLine
        label="Keywords"
        current={currentRules.keywords.join(', ')}
        proposed={proposedRules.keywords.join(', ')}
      />
      <DiffLine
        label="Stop Loss"
        current={`${currentRules.risk_management.stop_loss_pct}%`}
        proposed={`${proposedRules.risk_management.stop_loss_pct}%`}
      />
      <DiffLine
        label="Take Profit"
        current={`${currentRules.risk_management.take_profit_pct}%`}
        proposed={`${proposedRules.risk_management.take_profit_pct}%`}
      />
      <DiffLine
        label="Max Leverage"
        current={`${currentRules.risk_management.max_leverage}x`}
        proposed={`${proposedRules.risk_management.max_leverage}x`}
      />
    </div>
  );
}
