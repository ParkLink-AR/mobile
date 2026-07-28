const fs = require('fs');
const path = require('path');
const glob = require('glob');

const root = path.resolve(__dirname, '..');
const i18nPath = path.join(root, 'src', 'i18n', 'castellano.json');
const keys = JSON.parse(fs.readFileSync(i18nPath, 'utf8'));

const files = glob.sync('**/*.{tsx,ts,jsx,js}', { cwd: root, ignore: ['node_modules/**', 'build/**', 'dist/**'] });

function ensureImport(file, content) {
  if (/from\s+['"]@\/src\/i18n['"];?/.test(content)) return content;
  // add import at top
  return `import { t } from '@/src/i18n';\n` + content;
}

let replaced = 0;

files.forEach((rel) => {
  const abs = path.join(root, rel);
  let content = fs.readFileSync(abs, 'utf8');
  let original = content;

  Object.keys(keys).forEach((k) => {
    const v = keys[k];
    if (!v || v.length < 2) return;
    const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(['\"])${escaped}(['\"])`, 'g');
    if (re.test(content)) {
      content = content.replace(re, `t('${k}')`);
    }
  });

  if (content !== original) {
    content = ensureImport(rel, content);
    fs.writeFileSync(abs, content, 'utf8');
    replaced++;
    console.log('Patched', rel);
  }
});

console.log('Done. Files modified:', replaced);
