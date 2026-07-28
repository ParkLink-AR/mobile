**Migración de textos y temas**

- Archivos de idioma: `src/i18n/castellano.json` y `src/i18n/castellano.txt`.
- Helper: `src/i18n/index.ts` exporta `t(key, vars?)` y `setLanguage(lang)`.

Para migrar automáticamente las cadenas listadas en `castellano.json` a llamadas `t('clave')`, ejecutá:

```bash
node scripts/migrate-i18n.js
```

El script hace un reemplazo conservador de literales exactas y añadirá `import { t } from '@/src/i18n'` en los archivos modificados.

Temas:
- `src/theme/light.ts` y `src/theme/dark.ts` contienen paletas separadas.
- `src/theme/colors.ts` expone `palettes` usado por `useThemeColors`.

Para añadir inglés, creá `src/i18n/english.json` con las mismas claves y llamá `setLanguage('en')`.
