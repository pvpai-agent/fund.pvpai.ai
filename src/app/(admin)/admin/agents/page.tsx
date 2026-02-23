'use client';

import { useState } from 'react';
import { useAdminData } from '@/hooks/useAdminData';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatUsd, formatPnl, formatFuel } from '@/lib/utils/format';
import { shortenAddress } from '@/lib/utils/format';
import type { Agent } from '@/types/database';
import type { AgentTier } from '@/constants/trading';
import { AGENT_TIERS } from '@/constants/trading';

type AdminAgent = Agent & { owner_wallet: string };

const statusBadgeVariant = (status: string) => {
  switch (status) {
    case 'active':
      return 'green' as const;
    case 'paused':
      return 'gold' as const;
    case 'dead':
      return 'red' as const;
    default:
      return 'gray' as const;
  }
};

const columns: Column<AdminAgent>[] = [
  {
    key: 'name',
    label: 'Name',
    render: (row) => <span className="text-gray-200 font-bold">{row.name}</span>,
  },
  {
    key: 'owner',
    label: 'Owner',
    render: (row) => (
      <span className="text-cyber-blue">
        {shortenAddress(row.owner_wallet, 4)}
      </span>
    ),
  },
  {
    key: 'tier',
    label: 'Tier',
    render: (row) => {
      const tier = (row.parsed_rules?.tier as AgentTier) ?? 'sniper';
      const cfg = AGENT_TIERS[tier];
      return (
        <span>
          {cfg?.icon ?? '🤖'} {cfg?.name ?? tier}
        </span>
      );
    },
  },
  {
    key: 'status',
    label: 'Status',
    render: (row) => (
      <Badge
        variant={statusBadgeVariant(row.status)}
        pulse={row.status === 'active'}
      >
        {row.status === 'dead' ? 'K.I.A.' : row.status}
      </Badge>
    ),
  },
  {
    key: 'capital',
    label: 'Capital',
    sortable: true,
    sortValue: (row) => Number(row.capital_balance),
    render: (row) => (
      <span className="text-cyber-gold">
        {formatUsd(Number(row.capital_balance))}
      </span>
    ),
  },
  {
    key: 'fuel',
    label: 'Fuel',
    sortable: true,
    sortValue: (row) => Number(row.energy_balance),
    render: (row) => (
      <span className="text-fuchsia-400">
        {formatFuel(Number(row.energy_balance))}
      </span>
    ),
  },
  {
    key: 'pnl',
    label: 'P&L',
    sortable: true,
    sortValue: (row) => Number(row.total_pnl),
    render: (row) => (
      <span
        className={
          Number(row.total_pnl) >= 0 ? 'text-cyber-green' : 'text-cyber-red'
        }
      >
        {formatPnl(Number(row.total_pnl))}
      </span>
    ),
  },
  {
    key: 'winrate',
    label: 'Win%',
    sortable: true,
    sortValue: (row) => Number(row.win_rate),
    render: (row) => (
      <span className="text-cyber-blue">
        {Number(row.win_rate).toFixed(0)}%
      </span>
    ),
  },
  {
    key: 'trades',
    label: 'Trades',
    sortable: true,
    sortValue: (row) => row.total_trades,
    render: (row) => <span>{row.total_trades}</span>,
  },
  {
    key: 'created',
    label: 'Created',
    sortable: true,
    sortValue: (row) => row.created_at,
    render: (row) => (
      <span className="text-gray-500">
        {new Date(row.created_at).toLocaleDateString()}
      </span>
    ),
  },
];

const statusFilterOptions = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'dead', label: 'Dead' },
  { value: 'draft', label: 'Draft' },
  { value: 'closed', label: 'Closed' },
];

export default function AdminAgentsPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const { data: agents, isLoading } = useAdminData<AdminAgent[]>(
    '/api/admin/agents',
    statusFilter ? { status: statusFilter } : undefined
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-7xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-mono font-bold text-cyber-red uppercase tracking-wider">
          {'>'} Agents
        </h1>
        <span className="text-xs font-mono text-gray-500">
          {agents?.length ?? 0} results
        </span>
      </div>
      <DataTable
        columns={columns}
        data={agents ?? []}
        keyExtractor={(row) => row.id}
        filters={[
          {
            label: 'Status',
            key: 'status',
            options: statusFilterOptions,
          },
        ]}
        onFilterChange={(key, value) => {
          if (key === 'status') setStatusFilter(value);
        }}
      />
    </div>
  );
}
