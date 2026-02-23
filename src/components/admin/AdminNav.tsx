'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';

const adminNavItems = [
  { href: '/admin', label: 'Overview', icon: '#' },
  { href: '/admin/users', label: 'Users', icon: '@' },
  { href: '/admin/agents', label: 'Agents', icon: '&' },
  { href: '/admin/trades', label: 'Trades', icon: '~' },
  { href: '/admin/transactions', label: 'Ledger', icon: '$' },
  { href: '/admin/activity', label: 'Activity', icon: '>' },
  { href: '/admin/system', label: 'System', icon: '!' },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col w-56 border-r border-terminal-border bg-cyber-darker min-h-[calc(100vh-52px)]">
      <div className="p-4 border-b border-terminal-border">
        <p className="text-xs font-mono text-cyber-red uppercase tracking-widest font-bold">
          Admin Panel
        </p>
      </div>
      <nav className="flex flex-col gap-1 p-3 mt-2">
        {adminNavItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/admin' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded font-mono text-sm transition-all duration-200',
                isActive
                  ? 'bg-cyber-red/10 text-cyber-red border-l-2 border-cyber-red'
                  : 'text-gray-500 hover:text-cyber-red hover:bg-cyber-red/5 border-l-2 border-transparent'
              )}
            >
              <span className="w-4 text-center">{item.icon}</span>
              <span className="uppercase tracking-wider">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto p-4 border-t border-terminal-border">
        <Link
          href="/dashboard"
          className="text-[10px] font-mono text-gray-600 hover:text-cyber-green transition-colors"
        >
          {'<'} Back to Dashboard
        </Link>
      </div>
    </aside>
  );
}
