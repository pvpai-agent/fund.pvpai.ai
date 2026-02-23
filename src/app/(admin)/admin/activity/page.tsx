'use client';

import { useAdminData } from '@/hooks/useAdminData';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';

interface ActivityLog {
  id: string;
  agent_id: string;
  agent_name: string;
  price: number;
  news_count: number;
  candle_count: number;
  confidence: number;
  direction: 'long' | 'short';
  reason: string;
  technical_summary: string;
  should_trade: boolean;
  created_at: string;
}

const columns: Column<ActivityLog>[] = [
  {
    key: 'time',
    label: 'Time',
    sortable: true,
    sortValue: (row) => row.created_at,
    render: (row) => (
      <span className="text-gray-500">
        {new Date(row.created_at).toLocaleString()}
      </span>
    ),
  },
  {
    key: 'agent',
    label: 'Agent',
    render: (row) => (
      <span className="text-gray-200 font-bold">{row.agent_name}</span>
    ),
  },
  {
    key: 'price',
    label: 'Price',
    sortable: true,
    sortValue: (row) => row.price,
    render: (row) => (
      <span className="text-cyber-gold">${row.price.toFixed(2)}</span>
    ),
  },
  {
    key: 'news',
    label: 'News#',
    render: (row) => <span className="text-gray-400">{row.news_count}</span>,
  },
  {
    key: 'candles',
    label: 'Candles#',
    render: (row) => <span className="text-gray-400">{row.candle_count}</span>,
  },
  {
    key: 'confidence',
    label: 'Conf',
    sortable: true,
    sortValue: (row) => row.confidence,
    render: (row) => (
      <span className={
        row.confidence >= 70 ? 'text-cyber-green font-bold' :
        row.confidence >= 50 ? 'text-cyber-blue' :
        'text-gray-500'
      }>
        {row.confidence}%
      </span>
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
    key: 'reason',
    label: 'Reason',
    render: (row) => (
      <span className="text-gray-400 text-[10px] max-w-[200px] truncate block">
        {row.reason}
      </span>
    ),
  },
  {
    key: 'ta',
    label: 'Technical',
    render: (row) => (
      <span className="text-gray-500 text-[10px] max-w-[150px] truncate block">
        {row.technical_summary || '—'}
      </span>
    ),
  },
  {
    key: 'trade',
    label: 'Trade?',
    render: (row) => (
      <Badge variant={row.should_trade ? 'green' : 'gray'}>
        {row.should_trade ? 'YES' : 'NO'}
      </Badge>
    ),
  },
];

export default function AdminActivityPage() {
  const { data, isLoading } = useAdminData<ActivityLog[]>('/api/admin/activity');

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
          {'>'} AI Activity Log
        </h1>
        <span className="text-xs font-mono text-gray-500">
          {data?.length ?? 0} analyses recorded
        </span>
      </div>
      {(!data || data.length === 0) && (
        <div className="text-xs font-mono text-gray-600 bg-cyber-dark border border-terminal-border rounded p-3">
          Activity log is populated as the cron monitor runs AI analyses. Start the cron scheduler to see data here.
        </div>
      )}
      <DataTable
        columns={columns}
        data={data ?? []}
        keyExtractor={(row) => row.id}
        emptyMessage="No AI analyses recorded yet. Start the cron scheduler."
      />
    </div>
  );
}
