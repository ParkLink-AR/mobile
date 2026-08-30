// @ts-check
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const reactHooks = require('eslint-plugin-react-hooks');

module.exports = tseslint.config(
  // Base JS recommended rules
  js.configs.recommended,

  // TypeScript rules (type-aware disabled — no tsconfig needed for fast CI)
  ...tseslint.configs.recommended,

  // React Hooks rules — catches missing deps, hooks called conditionally, etc.
  {
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },

  // React Native image assets use require() — this is the only supported pattern
  // for local static assets in Metro/Expo. Allow it project-wide.
  {
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // Project-wide rules
  {
    rules: {
      // ── The root cause of the bundler 404 ──────────────────────────────────
      // Two separate `import { x } from 'react'` lines in the same file trip
      // Metro's module graph and make expo-router report every route as 404.
      'no-duplicate-imports': 'error',

      // ── Unused variables → dead code that hides real problems ──────────────
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // ── TypeScript safety ──────────────────────────────────────────────────
      '@typescript-eslint/no-explicit-any': 'warn',

      // ── Allow `catch {}` without a binding (used in confirm.tsx pre-check) ─
      'no-empty': ['error', { allowEmptyCatch: true }],

      // ── set-state-in-effect: kept as warn (not error) because many valid React
      // Native patterns (debounce early returns, async fetch callbacks) trigger
      // this rule. It still alerts on genuinely synchronous setState in effects
      // that would cause cascading renders, but won't block the build.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },

  // Ignore generated/vendored files
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.expo/**',
      'ios/**',
      'android/**',
      'scripts/**',
    ],
  },
);
