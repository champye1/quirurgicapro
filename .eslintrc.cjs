module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  overrides: [
    {
      // Los tests E2E de Playwright corren en Node.js — process está disponible
      files: ['e2e/**/*.js', 'e2e/**/*.ts'],
      env: { node: true },
    },
  ],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.2' } },
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    // Project doesn't use PropTypes — validated at the API/DB boundary
    'react/prop-types': 'off',
    // Unescaped entities in JSX are not a safety issue
    'react/no-unescaped-entities': 'off',
    // Control chars in regex are intentional in sanitizeInput.js
    'no-control-regex': 'off',
    'no-unused-vars': ['warn', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
    'react-hooks/exhaustive-deps': 'warn',
  },
}
