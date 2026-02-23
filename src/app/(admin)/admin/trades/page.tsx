'use client';

import { useState } from 'react';
import { useAdminData } from '@/hooks/useAdminData';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatUsd, formatPnl } from '@/lib/utils/format';

interface AdminTrade {
  id: string;
  agent_id: string;
  agent_name: string;
  user_id: string;
  symbol: string;
  direction: 'long' | 'short';
  size: number;
  leverage: number;
  entry_price: number;
  exit_price: number | null;
  realized_pnl: number;
  fee_amount: number;
  status: string;
  trigger_reason: string;
  opened_at: string;
  closed_at: string | null;
}

const columns: Column<AdminTrade>[] = [
  {
    key: 'agent',
    label: 'Agent',
    render: (row) => (
      <span className="text-gray-200 font-bold">{row.agent_name}</span>
    ),
  },
  {
    key: 'direction',
    label: 'Dir',
    render: (row) => (
      <Badge variant={row.direction === 'long' ? 'green' : 'red'}>
        {row.direction.toUpperCase()}
      </Badge>
    ),
  },
  {
    key: 'size',
    label: 'Size',
    sortable: true,
    sortValue: (row) => Number(row.size),
    render: (row) => <span>{formatUsd(Number(row.size))}</span>,
  },
  {
    key: 'leverage',
    label: 'Lev',
    render: (row) => <span className="text-cyber-blue">{row.leverage}x</span>,
  },
  {
    key: 'entry',
    label: 'Entry',
    render: (row) => (
      <span className="text-gray-300">
        ${Number(row.entry_price).toFixed(2)}
      </span>
    ),
  },
  {
    key: 'exit',
    label: 'Exit',
    render: (row) => (
      <span className="text-gray-300">
        {row.exit_price ? `$${Number(row.exit_price).toFixed(2)}` : '—'}
      </span>
    ),
  },
  {
    key: 'pnl',
    label: 'P&L',
    sortable: true,
    sortValue: (row) => Number(row.realized_pnl),
    render: (row) => (
      <span
        className={
          Number(row.realized_pnl) >= 0 ? 'text-cyber-green' : 'text-cyber-red'
        }
      >
        {formatPnl(Number(row.realized_pnl))}
      </span>
    ),
  },
  {
    key: 'fee',
    label: 'Fee',
    render: (row) => (
      <span className="text-cyber-gold">{formatUsd(Number(row.fee_amount))}</span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    render: (row) => (
      <Badge variant={row.status === 'open' ? 'blue' : row.status === 'closed' ? 'gray' : 'red'}>
        {row.status}
      </Badge>
    ),
  },
  {
    key: 'reason',
    label: 'Trigger',
    render: (row) => (
      <span className="text-gray-500 text-[10px]">
        {row.trigger_reason ?? '—'}
      </span>
    ),
  },
  {
    key: 'opened',
    label: 'Opened',
    sortable: true,
    sortValue: (row) => row.opened_at,
    render: (row) => (
      <span className="text-gray-500">
        {new Date(row.opened_at).toLocaleString()}
      </span>
    ),
  },
];

export default function AdminTradesPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const params: Record<string, string> = {};
  if (statusFilter) params.status = statusFilter;

  const { data, isLoading } = useAdminData<AdminTrade[]>(
    '/api/admin/trades',
    Object.keys(params).length > 0 ? params : undefined
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
          {'>'} Trades
        </h1>
        <span className="text-xs font-mono text-gray-500">
          {data?.length ?? 0} results
        </span>
      </div>
      {data?.length === 0 && !statusFilter && (
        <div className="text-xs font-mono text-gray-600 bg-cyber-dark border border-terminal-border rounded p-3">
          Note: Trade data requires Supabase. In mock-db mode this page is empty.
        </div>
      )}
      <DataTable
        columns={columns}
        data={data ?? []}
        keyExtractor={(row) => row.id}
        filters={[
          {
            label: 'Status',
            key: 'status',
            options: [
              { value: 'open', label: 'Open' },
              { value: 'closed', label: 'Closed' },
              { value: 'cancelled', label: 'Cancelled' },
            ],
          },
        ]}
        onFilterChange={(key, value) => {
          if (key === 'status') setStatusFilter(value);
        }}
        emptyMessage="No trades recorded yet."
      />
    </div>
  );
}
