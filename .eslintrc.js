module.exports = {
  env: {
    es6: true,
    node: true,
    jest: true,
  },
  extends: [ 'codex' ],
  rules: {
    '@typescript-eslint/no-unused-expressions': 'error',
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
