'use client';

import { useLanguageStore } from '@/stores/language.store';

export function LanguageToggle() {
  const { lang, toggle } = useLanguageStore();

  return (
    <button
      onClick={toggle}
      className="w-8 h-8 flex items-center justify-center rounded border border-terminal-border text-[10px] font-mono font-bold text-gray-400 hover:text-cyber-green hover:border-cyber-green/40 transition-colors"
      title={lang === 'en' ? 'Switch to Chinese' : '切换为英文'}
    >
      {lang === 'en' ? '中' : 'EN'}
    </button>
  );
}
