import tsPlugin from '@typescript-eslint/eslint-plugin'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  ...tsPlugin.configs['flat/recommended'],
  reactHooks.configs.flat.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-refresh': reactRefresh
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // The project uses `ref` as a prop name for FileRef, not React refs.
      'react-hooks/refs': 'off'
    }
  },
  {
    ignores: ['out/**', 'node_modules/**', 'dist/**', '*.config.*']
  }
]
