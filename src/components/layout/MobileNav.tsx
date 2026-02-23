'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { useT } from '@/hooks/useTranslation';

export function MobileNav() {
  const pathname = usePathname();
  const t = useT();

  const items = [
    { href: '/', label: t.sidebar.home, icon: '~', exact: true },
    { href: '/explore', label: t.sidebar.explore, icon: '?' },
    { href: '/agent/new', label: '+', icon: '+', isCenter: true },
    { href: '/dashboard', label: t.sidebar.dashboard, icon: '>' },
    { href: '/settings', label: t.sidebar.settings, icon: '*' },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-terminal-border bg-cyber-black/95 backdrop-blur-sm">
      <div className="flex items-center justify-around px-2 py-1">
        {items.map((item) => {
          const isActive = 'exact' in item && item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);

          if (item.isCenter) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-center w-10 h-10 -mt-3 rounded-full bg-cyber-green text-cyber-black font-mono font-bold text-lg border-2 border-cyber-green shadow-[0_0_12px_rgba(0,255,65,0.3)]"
              >
                +
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded transition-colors',
                isActive ? 'text-cyber-green' : 'text-gray-600'
              )}
            >
              <span className={clsx('text-sm font-mono', isActive && 'neon-glow')}>{item.icon}</span>
              <span className="text-[8px] font-mono uppercase tracking-wider">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
