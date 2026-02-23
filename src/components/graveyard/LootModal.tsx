'use client';

import { Modal } from '@/components/ui/Modal';
import { Card } from '@/components/ui/Card';
import type { ParsedRules, EnergyLog } from '@/types/database';

interface LootData {
  prompt: string;
  parsed_rules: ParsedRules;
  energy_logs: EnergyLog[];
}

interface LootModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentName: string;
  data: LootData | null;
}

export function LootModal({ isOpen, onClose, agentName, data }: LootModalProps) {
  if (!data) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${agentName} — Looted Intel`}>
      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
        {/* Strategy Prompt */}
        <div>
          <h3 className="text-[10px] font-mono text-cyber-gold uppercase tracking-wider mb-1">
            Original Prompt
          </h3>
          <Card variant="terminal" className="text-xs !p-3">
            <pre className="whitespace-pre-wrap text-gray-300">{data.prompt}</pre>
          </Card>
        </div>

        {/* Parsed Rules */}
        <div>
          <h3 className="text-[10px] font-mono text-cyber-gold uppercase tracking-wider mb-1">
            Parsed Rules
          </h3>
          <Card className="!p-3 space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-gray-500">Direction</span>
              <span className="text-gray-300">{data.parsed_rules.direction_bias}</span>
            </div>
            <div className="flex justify-between text-xs font-mono">
              <span className="text-gray-500">Keywords</span>
              <span className="text-gray-300">{data.parsed_rules.keywords.join(', ')}</span>
            </div>
            <div className="flex justify-between text-xs font-mono">
              <span className="text-gray-500">Stop Loss</span>
              <span className="text-gray-300">{data.parsed_rules.risk_management.stop_loss_pct}%</span>
            </div>
            <div className="flex justify-between text-xs font-mono">
              <span className="text-gray-500">Take Profit</span>
              <span className="text-gray-300">{data.parsed_rules.risk_management.take_profit_pct}%</span>
            </div>
            <div className="flex justify-between text-xs font-mono">
              <span className="text-gray-500">Max Leverage</span>
              <span className="text-gray-300">{data.parsed_rules.risk_management.max_leverage}x</span>
            </div>
          </Card>
        </div>

        {/* Energy Logs */}
        <div>
          <h3 className="text-[10px] font-mono text-cyber-gold uppercase tracking-wider mb-1">
            Energy Logs (Last {data.energy_logs.length})
          </h3>
          <Card className="!p-0 max-h-40 overflow-y-auto">
            {data.energy_logs.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs font-mono text-gray-600">
                No energy logs available.
              </div>
            ) : (
              <div className="divide-y divide-terminal-border/50">
                {data.energy_logs.slice(0, 20).map((log) => (
                  <div key={log.id} className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono">
                    <span className={log.amount >= 0 ? 'text-cyber-green' : 'text-cyber-red'}>
                      {log.amount >= 0 ? '+' : ''}{log.amount.toFixed(0)}
                    </span>
                    <span className="text-gray-500">{log.reason}</span>
                    <span className="text-gray-700 ml-auto">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </Modal>
  );
}
