'use client';

import { useAdminData } from '@/hooks/useAdminData';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatUsd, formatPnl } from '@/lib/utils/format';
import { shortenAddress } from '@/lib/utils/format';

interface AdminUser {
  id: string;
  wallet_address: string;
  balance_usdt: number;
  referral_code: string;
  referred_by: string | null;
  agents_count: number;
  active_agents: number;
  total_pnl: number;
  created_at: string;
}

const columns: Column<AdminUser>[] = [
  {
    key: 'wallet',
    label: 'Wallet',
    render: (row) => (
      <span className="text-cyber-blue">{shortenAddress(row.wallet_address, 6)}</span>
    ),
  },
  {
    key: 'balance',
    label: 'Balance',
    sortable: true,
    sortValue: (row) => Number(row.balance_usdt),
    render: (row) => (
      <span className="text-cyber-gold">{formatUsd(Number(row.balance_usdt))}</span>
    ),
  },
  {
    key: 'agents',
    label: 'Agents',
    sortable: true,
    sortValue: (row) => row.agents_count,
    render: (row) => (
      <span>
        <span className="text-cyber-green">{row.active_agents}</span>
        <span className="text-gray-600"> / {row.agents_count}</span>
      </span>
    ),
  },
  {
    key: 'pnl',
    label: 'Total P&L',
    sortable: true,
    sortValue: (row) => row.total_pnl,
    render: (row) => (
      <span className={row.total_pnl >= 0 ? 'text-cyber-green' : 'text-cyber-red'}>
        {formatPnl(row.total_pnl)}
      </span>
    ),
  },
  {
    key: 'referral',
    label: 'Ref Code',
    render: (row) => <span className="text-cyber-purple">{row.referral_code}</span>,
  },
  {
    key: 'referred_by',
    label: 'Referred By',
    render: (row) => (
      <span className="text-gray-500">{row.referred_by ?? '—'}</span>
    ),
  },
  {
    key: 'joined',
    label: 'Joined',
    sortable: true,
    sortValue: (row) => row.created_at,
    render: (row) => (
      <span className="text-gray-500">
        {new Date(row.created_at).toLocaleDateString()}
      </span>
    ),
  },
];

export default function AdminUsersPage() {
  const { data: users, isLoading } = useAdminData<AdminUser[]>(
    '/api/admin/users'
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
          {'>'} Users
        </h1>
        <span className="text-xs font-mono text-gray-500">
          {users?.length ?? 0} total
        </span>
      </div>
      <DataTable
        columns={columns}
        data={users ?? []}
        keyExtractor={(row) => row.id}
      />
    </div>
  );
}
