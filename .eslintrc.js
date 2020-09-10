module.exports = {
  env: {
    es6: true,
    node: true,
    jest: true,
  },
  extends: ['codex', 'prettier', 'prettier/@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-unused-expressions': 'error',
    'no-unused-expressions': 'off',
  },
  globals: {
    NodeJS: true,
  },
};
