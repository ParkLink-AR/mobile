import castellano from './castellano.json';

type LangMap = Record<string, string>;

const languages: Record<string, LangMap> = {
  es: castellano,
};

let current = languages.es;

export function setLanguage(lang: string) {
  if (languages[lang]) current = languages[lang];
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

export default { t, setLanguage };
