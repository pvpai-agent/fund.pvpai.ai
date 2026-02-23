'use client';

import { useState } from 'react';
import { useAdminData } from '@/hooks/useAdminData';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatUsd } from '@/lib/utils/format';
import { shortenAddress } from '@/lib/utils/format';

interface AdminTransaction {
  id: string;
  user_id: string;
  user_wallet: string;
  agent_id: string | null;
  type: string;
  status: string;
  amount: number;
  token: string;
  description: string | null;
  tx_hash: string | null;
  created_at: string;
}

const txTypeBadgeVariant = (type: string) => {
  if (type === 'deposit') return 'green' as const;
  if (type === 'performance_fee' || type === 'referral_fee') return 'gold' as const;
  if (type === 'energy_burn' || type === 'energy_vampire') return 'red' as const;
  if (type === 'trade_pnl') return 'blue' as const;
  return 'gray' as const;
};

const columns: Column<AdminTransaction>[] = [
  {
    key: 'wallet',
    label: 'User',
    render: (row) => (
      <span className="text-cyber-blue">
        {shortenAddress(row.user_wallet, 4)}
      </span>
    ),
  },
  {
    key: 'type',
    label: 'Type',
    render: (row) => (
      <Badge variant={txTypeBadgeVariant(row.type)}>
        {row.type.replace(/_/g, ' ')}
      </Badge>
    ),
  },
  {
    key: 'amount',
    label: 'Amount',
    sortable: true,
    sortValue: (row) => Number(row.amount),
    render: (row) => {
      const amt = Number(row.amount);
      return (
        <span className={amt >= 0 ? 'text-cyber-green' : 'text-cyber-red'}>
          {amt >= 0 ? '+' : ''}
          {formatUsd(amt)}
        </span>
      );
    },
  },
  {
    key: 'token',
    label: 'Token',
    render: (row) => <span className="text-gray-400">{row.token}</span>,
  },
  {
    key: 'description',
    label: 'Description',
    render: (row) => (
      <span className="text-gray-500 max-w-[200px] truncate block">
        {row.description ?? '—'}
      </span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    render: (row) => (
      <Badge
        variant={
          row.status === 'confirmed'
            ? 'green'
            : row.status === 'pending'
              ? 'gold'
              : 'red'
        }
      >
        {row.status}
      </Badge>
    ),
  },
  {
    key: 'tx_hash',
    label: 'Tx Hash',
    render: (row) => (
      <span className="text-gray-600">
        {row.tx_hash ? shortenAddress(row.tx_hash, 4) : '—'}
      </span>
    ),
  },
  {
    key: 'created',
    label: 'Date',
    sortable: true,
    sortValue: (row) => row.created_at,
    render: (row) => (
      <span className="text-gray-500">
        {new Date(row.created_at).toLocaleString()}
      </span>
    ),
  },
];

const txTypeOptions = [
  'deposit',
  'agent_mint',
  'trade_pnl',
  'performance_fee',
  'referral_fee',
  'energy_purchase',
  'energy_burn',
  'energy_vampire',
  'energy_referral',
  'capital_return',
  'fund_allocation',
  'fund_deallocation',
  'withdrawal',
  'subscription',
].map((t) => ({ value: t, label: t.replace(/_/g, ' ') }));

export default function AdminTransactionsPage() {
  const [typeFilter, setTypeFilter] = useState('');
  const params: Record<string, string> = {};
  if (typeFilter) params.type = typeFilter;

  const { data, isLoading } = useAdminData<AdminTransaction[]>(
    '/api/admin/transactions',
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
          {'>'} Ledger
        </h1>
        <span className="text-xs font-mono text-gray-500">
          {data?.length ?? 0} results
        </span>
      </div>
      <DataTable
        columns={columns}
        data={data ?? []}
        keyExtractor={(row) => row.id}
        filters={[
          {
            label: 'Type',
            key: 'type',
            options: txTypeOptions,
          },
        ]}
        onFilterChange={(key, value) => {
          if (key === 'type') setTypeFilter(value);
        }}
        emptyMessage="No transactions recorded yet."
      />
    </div>
  );
}
