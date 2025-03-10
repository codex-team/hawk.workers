module.exports = {
  env: {
    es6: true,
    node: true,
    jest: true,
  },
  extends: ['codex', 'codex/ts'],
  ignorePatterns: [
    'package.json',
    'tsconfig.json',
    'dist',
  ],
  rules: {
    '@typescript-eslint/no-unused-expressions': 'error',
    '@typescript-eslint/no-var-requires': 'off',
    'no-unused-expressions': 'off',
  },
  globals: {
    NodeJS: true,
  },
  overrides: [ {
    files: ['*.test.ts', '*.mock.ts'],
    rules: {
      '@typescript-eslint/no-magic-numbers': 'off',
    },
  } ],
};
