'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { useT } from '@/hooks/useTranslation';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { LanguageToggle } from '@/components/ui/LanguageToggle';

export function Sidebar() {
  const pathname = usePathname();
  const t = useT();

  const navItems = [
    { href: '/', label: t.sidebar.home, icon: '~', exact: true },
    { href: '/explore', label: t.sidebar.explore, icon: '?' },
    { href: '/agent/new', label: t.sidebar.deployAgent, icon: '+' },
    { href: '/dashboard', label: t.sidebar.dashboard, icon: '>' },
    { href: '/settings', label: t.sidebar.settings, icon: '*' },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-56 border-r border-terminal-border bg-cyber-darker fixed top-[52px] left-0 h-[calc(100vh-52px)] z-30">
      <nav className="flex flex-col gap-1 p-3 mt-4">
        {navItems.map((item) => {
          const isActive = 'exact' in item && item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded font-mono text-sm transition-all duration-200',
                isActive
                  ? 'bg-cyber-green/10 text-cyber-green border-l-2 border-cyber-green'
                  : 'text-gray-500 hover:text-cyber-green hover:bg-cyber-green/5 border-l-2 border-transparent'
              )}
            >
              <span className={clsx('w-4 text-center', isActive && 'neon-glow')}>
                {item.icon}
              </span>
              <span className="uppercase tracking-wider">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-terminal-border">
        <div className="flex items-center gap-2 px-4 py-3">
          <ThemeToggle />
          <LanguageToggle />
        </div>
        <div className="px-4 pb-4 text-[10px] font-mono text-gray-700 space-y-0.5">
          <p>{t.sidebar.version}</p>
          <p>Multi-Asset | Hyperliquid</p>
          <p className="text-cyber-green/50">{t.sidebar.systemOk}</p>
        </div>
      </div>
    </aside>
  );
}
