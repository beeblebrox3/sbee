module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
    node: true
  },
  extends: 'standard-with-typescript',
  parserOptions: {
    project: ['./tsconfig.eslint.json']
  },
  rules: {
  }
}
