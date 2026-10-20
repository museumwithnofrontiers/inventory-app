import eslint from '@eslint/js'
import globals from 'globals'

export default [
  { ignores: ['node_modules/**'] },
  eslint.configs.recommended,
  {
    files: ['**/*.mjs', '**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.node },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // The browser side of the capture tools runs inside page.evaluate().
    files: ['tools/capture.mjs', 'tools/assets.mjs', 'tools/static.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
]
