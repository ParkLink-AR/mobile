**Migración de textos y temas**

- Archivos de idioma por carpeta: `src/i18n/es/castellano.json` y `src/i18n/es/castellano.txt`.
- Helper: `src/i18n/index.ts` exporta `t(key, vars?)` y `setLanguage(lang)`.

Para migrar automáticamente las cadenas listadas en `castellano.json` a llamadas `t('clave')`, ejecutá:

```bash
node scripts/migrate-i18n.js
```

El script hace un reemplazo conservador de literales exactas y añadirá `import { t } from '@/src/i18n'` en los archivos modificados.

Temas:
- `src/theme/light.ts` y `src/theme/dark.ts` contienen paletas separadas.
- `src/theme/colors.ts` expone `palettes` usado por `useThemeColors`.

Idiomas disponibles (carpetas):
- `es`: Español (castellano) — `src/i18n/es/castellano.json`
- `en`: English — `src/i18n/en/english.json`
- `ja`: 日本語 — `src/i18n/ja/japanese.json`

Para cambiar el idioma en tiempo de ejecución:

```ts
import { setLanguage } from '@/src/i18n';
setLanguage('en'); // 'es' | 'en' | 'ja'
```
