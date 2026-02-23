'use client';

import { useAdminData } from '@/hooks/useAdminData';
import { StatCard } from '@/components/admin/StatCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatUsd, formatPnl, formatFuel } from '@/lib/utils/format';

interface PlatformStats {
  totalUsers: number;
  totalAgents: number;
  agentsByStatus: Record<string, number>;
  totalTrades: number;
  totalPnl: number;
  totalDepositVolume: number;
  platformRevenue: number;
  performanceFees: number;
  referralFees: number;
  totalAum: number;
  totalFuel: number;
  activeBurnRatePerHour: number;
}

export default function AdminOverviewPage() {
  const { data: stats, isLoading } = useAdminData<PlatformStats>(
    '/api/admin/stats'
  );

  if (isLoading || !stats) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <h1 className="text-xl font-mono font-bold text-cyber-red uppercase tracking-wider">
        {'>'} Platform Overview
      </h1>

      {/* Row 1: Core metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Users"
          value={String(stats.totalUsers)}
          color="text-cyber-blue"
          delay={0.05}
        />
        <StatCard
          label="Total Agents"
          value={String(stats.totalAgents)}
          subtext={`${stats.agentsByStatus.active ?? 0} active / ${stats.agentsByStatus.dead ?? 0} dead`}
          color="text-cyber-green"
          delay={0.1}
        />
        <StatCard
          label="Total Trades"
          value={String(stats.totalTrades)}
          color="text-cyber-purple"
          delay={0.15}
        />
        <StatCard
          label="Total P&L"
          value={formatPnl(stats.totalPnl)}
          color={stats.totalPnl >= 0 ? 'text-cyber-green' : 'text-cyber-red'}
          delay={0.2}
        />
      </div>

      {/* Row 2: Financial metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Deposit Volume"
          value={formatUsd(stats.totalDepositVolume)}
          color="text-cyber-gold"
          delay={0.25}
        />
        <StatCard
          label="Platform Revenue"
          value={formatUsd(stats.platformRevenue)}
          subtext={`Perf: ${formatUsd(stats.performanceFees)} | Ref: ${formatUsd(stats.referralFees)}`}
          color="text-cyber-green"
          delay={0.3}
        />
        <StatCard
          label="Total AUM"
          value={formatUsd(stats.totalAum)}
          subtext="Active agent capital"
          color="text-cyber-gold"
          delay={0.35}
        />
        <StatCard
          label="Total Fuel"
          value={formatFuel(stats.totalFuel)}
          subtext={`Burn: ${formatFuel(stats.activeBurnRatePerHour)}/hr (${formatFuel(stats.activeBurnRatePerHour * 24)}/day)`}
          color="text-fuchsia-400"
          delay={0.4}
        />
      </div>

      {/* Row 3: Agent breakdown */}
      <div>
        <h2 className="text-sm font-mono text-gray-400 uppercase tracking-wider mb-3">
          {'// Agent Breakdown'}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {(['active', 'paused', 'dead', 'draft', 'closed'] as const).map(
            (status) => {
              const colorMap = {
                active: 'text-cyber-green',
                paused: 'text-cyber-gold',
                dead: 'text-cyber-red',
                draft: 'text-gray-400',
                closed: 'text-gray-500',
              };
              return (
                <StatCard
                  key={status}
                  label={status}
                  value={String(stats.agentsByStatus[status] ?? 0)}
                  color={colorMap[status]}
                  delay={0.45}
                />
              );
            }
          )}
        </div>
      </div>
    </div>
  );
}
