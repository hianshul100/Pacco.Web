import js from '@eslint/js'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.jest },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // LOW_LEVEL_SPEC-13652-wave-1.md §L.3 item 8 invariant 4: no backend
      // string, status line or request body may reach the console.
      'no-restricted-properties': [
        'error',
        { object: 'console', property: 'log', message: 'Use the Diagnostics module (src/platform/diagnostics.ts), which redacts the request body.' },
        { object: 'console', property: 'info', message: 'Use the Diagnostics module (src/platform/diagnostics.ts), which redacts the request body.' },
      ],
    },
  },
  {
    files: ['vite.config.ts', 'jest.config.cjs', '*.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
)
