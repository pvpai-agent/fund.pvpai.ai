'use client';

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/Card';

export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
  sortable?: boolean;
  sortValue?: (row: T) => number | string;
}

interface FilterConfig {
  label: string;
  key: string;
  options: { value: string; label: string }[];
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  filters?: FilterConfig[];
  pageSize?: number;
  keyExtractor: (row: T) => string;
  emptyMessage?: string;
  onFilterChange?: (key: string, value: string) => void;
}

export function DataTable<T>({
  columns,
  data,
  filters,
  pageSize = 25,
  keyExtractor,
  emptyMessage = 'No data found.',
  onFilterChange,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return data;
    return [...data].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir, columns]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const handleSort = (key: string) => {
    const col = columns.find((c) => c.key === key);
    if (!col?.sortable) return;
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(0);
  };

  return (
    <Card className="overflow-hidden !p-0">
      {/* Filter bar */}
      {filters && filters.length > 0 && (
        <div className="flex gap-3 p-3 border-b border-terminal-border">
          {filters.map((f) => (
            <select
              key={f.key}
              onChange={(e) => {
                onFilterChange?.(f.key, e.target.value);
                setPage(0);
              }}
              className="bg-cyber-dark border border-terminal-border rounded px-2 py-1 text-xs font-mono text-gray-300 focus:border-cyber-red/50 outline-none"
            >
              <option value="">{f.label}: All</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-terminal-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`px-3 py-2.5 text-left text-gray-500 uppercase tracking-wider whitespace-nowrap ${
                    col.sortable
                      ? 'cursor-pointer hover:text-cyber-red select-none'
                      : ''
                  }`}
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span className="text-cyber-red ml-1">
                      {sortDir === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-8 text-center text-gray-600"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paged.map((row) => (
                <tr
                  key={keyExtractor(row)}
                  className="border-b border-terminal-border/50 hover:bg-cyber-red/5 transition-colors"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className="px-3 py-2 text-gray-300 whitespace-nowrap"
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-3 border-t border-terminal-border">
          <span className="text-[10px] text-gray-600">
            {sorted.length} results — Page {page + 1} / {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="px-2 py-1 text-xs font-mono text-gray-400 hover:text-cyber-red disabled:opacity-30 transition-colors"
            >
              {'<'} Prev
            </button>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="px-2 py-1 text-xs font-mono text-gray-400 hover:text-cyber-red disabled:opacity-30 transition-colors"
            >
              Next {'>'}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
