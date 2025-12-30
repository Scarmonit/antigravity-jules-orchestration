module.exports = {
  root: true,
  env: { browser: true, es2020: true, jest: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.2' } },
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    'react/prop-types': 'off', // simplified for this dashboard
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
  globals: {
    global: true,
    process: true,
  },
  overrides: [
    {
      files: ['**/*.test.jsx', '**/*.test.js'],
      env: {
        jest: true,
      },
      globals: {
        vi: true,
        describe: true,
        it: true,
        expect: true,
        beforeEach: true,
        afterEach: true,
      }
    }
  ]
}
