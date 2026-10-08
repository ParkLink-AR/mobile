import castellano from './es/castellano.json';
import english from './en/english.json';
import japanese from './ja/japanese.json';

type LangMap = Record<string, string>;

const languages: Record<string, LangMap> = {
  es: castellano,
  en: english,
  ja: japanese,
};

export const availableLanguages = Object.keys(languages);

let current = languages.es;
let currentCode = 'es';

export function setLanguage(lang: string) {
  if (languages[lang]) {
    current = languages[lang];
    currentCode = lang;
  }
}

/** The active language's code ('es' | 'en' | 'ja'), e.g. for formatting dates. */
export function getLanguage(): string {
  return currentCode;
}

export function t(key: string, vars?: Record<string, string | number>) {
  let str = current[key] ?? key;
  if (vars) {
    Object.keys(vars).forEach((k) => {
      str = str.replace(new RegExp(`%\\{${k}\\}`, 'g'), String(vars[k]));
    });
  }
  return str;
}

/**
 * Call this in any component that renders text via t().
 * It subscribes to the language store so the component re-renders when
 * the language changes — without which t() would return stale translations.
 */
export function useLanguage() {
  // Lazy require avoids a circular dependency at module evaluation time
   
  const { useSettingsStore } = require('@/src/store/useSettingsStore') as typeof import('@/src/store/useSettingsStore');
  useSettingsStore((s: { language: string }) => s.language);
}

export default { t, setLanguage, getLanguage, availableLanguages };
