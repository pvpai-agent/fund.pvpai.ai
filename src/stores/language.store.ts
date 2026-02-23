import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Lang = 'en' | 'zh';

interface LanguageState {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggle: () => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      lang: 'en',
      setLang: (lang) => set({ lang }),
      toggle: () => set((s) => ({ lang: s.lang === 'en' ? 'zh' : 'en' })),
    }),
    { name: 'pvp_lang' }
  )
);
