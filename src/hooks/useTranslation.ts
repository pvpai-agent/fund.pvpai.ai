import { useLanguageStore } from '@/stores/language.store';
import { en, zh } from '@/constants/translations';
import type { Translations } from '@/constants/translations';

const translations: Record<string, Translations> = { en, zh };

export function useT(): Translations {
  const lang = useLanguageStore((s) => s.lang);
  return translations[lang] ?? en;
}
