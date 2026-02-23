'use client';

import { useState } from 'react';
import { useAdminData } from '@/hooks/useAdminData';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';

interface SystemData {
  checks: {
    supabase: boolean;
    cronSecret: boolean;
    hyperliquidKey: boolean;
    hyperliquidWallet: boolean;
    hyperliquidTestnet: boolean;
    claudeKey: boolean;
    platformWallet: string;
    nodeEnv: string;
    adminWallets: number;
  };
  timestamp: string;
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${
        ok ? 'bg-cyber-green' : 'bg-cyber-red animate-pulse'
      }`}
    />
  );
}

export default function AdminSystemPage() {
  const { data, isLoading, refetch } = useAdminData<SystemData>(
    '/api/admin/system'
  );
  const [cronResult, setCronResult] = useState<string | null>(null);
  const [cronLoading, setCronLoading] = useState(false);

  const triggerCron = async (endpoint: string) => {
    setCronLoading(true);
    setCronResult(null);
    try {
      const res = await fetch(endpoint);
      const json = await res.json();
      setCronResult(JSON.stringify(json, null, 2));
    } catch (err) {
      setCronResult(
        `Error: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    } finally {
      setCronLoading(false);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const { checks } = data;

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-xl font-mono font-bold text-cyber-red uppercase tracking-wider">
        {'>'} System Health
      </h1>

      <Card>
        <h3 className="text-sm font-mono font-bold text-gray-400 uppercase tracking-wider mb-4">
          Environment Checks
        </h3>
        <div className="space-y-3 text-xs font-mono">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Supabase</span>
            <span className="flex items-center gap-2">
              <StatusDot ok={checks.supabase} />
              <span className={checks.supabase ? 'text-cyber-green' : 'text-cyber-red'}>
                {checks.supabase ? 'Connected' : 'Mock DB Mode'}
              </span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Hyperliquid Key</span>
            <span className="flex items-center gap-2">
              <StatusDot ok={checks.hyperliquidKey} />
              <span className={checks.hyperliquidKey ? 'text-cyber-green' : 'text-cyber-red'}>
                {checks.hyperliquidKey ? 'Set' : 'Missing'}
              </span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Hyperliquid Testnet</span>
            <span className={checks.hyperliquidTestnet ? 'text-cyber-gold' : 'text-cyber-green'}>
              {checks.hyperliquidTestnet ? 'Testnet' : 'Mainnet'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Claude API Key</span>
            <span className="flex items-center gap-2">
              <StatusDot ok={checks.claudeKey} />
              <span className={checks.claudeKey ? 'text-cyber-green' : 'text-cyber-red'}>
                {checks.claudeKey ? 'Set' : 'Missing'}
              </span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Cron Secret</span>
            <span className="flex items-center gap-2">
              <StatusDot ok={checks.cronSecret} />
              <span className={checks.cronSecret ? 'text-cyber-green' : 'text-cyber-red'}>
                {checks.cronSecret ? 'Set' : 'Missing'}
              </span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Platform Wallet</span>
            <span className="text-cyber-blue text-[10px]">
              {checks.platformWallet}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Node Env</span>
            <span className="text-gray-300">{checks.nodeEnv}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Admin Wallets</span>
            <span className="text-gray-300">{checks.adminWallets} configured</span>
          </div>
        </div>
        <p className="text-[10px] font-mono text-gray-700 mt-4">
          Last checked: {new Date(data.timestamp).toLocaleString()}
        </p>
      </Card>

      <Card>
        <h3 className="text-sm font-mono font-bold text-gray-400 uppercase tracking-wider mb-4">
          Manual Cron Triggers
        </h3>
        <div className="flex gap-3">
          <Button
            variant="primary"
            size="sm"
            onClick={() => triggerCron('/api/cron/monitor')}
            loading={cronLoading}
          >
            Run Monitor
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => triggerCron('/api/cron/settle')}
            loading={cronLoading}
          >
            Run Settlement
          </Button>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            Refresh
          </Button>
        </div>
        {cronResult && (
          <pre className="mt-4 p-3 bg-cyber-black border border-terminal-border rounded text-[10px] font-mono text-gray-400 max-h-64 overflow-auto">
            {cronResult}
          </pre>
        )}
      </Card>
    </div>
  );
}
