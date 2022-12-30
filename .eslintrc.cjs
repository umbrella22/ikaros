module.exports = {
  root: true,

  extends: 'plugin:@ikaros/ts-recommended',

  rules: {
    'no-console': 'off',

    'unicorn/no-process-exit': 'off',

    '@typescript-eslint/no-empty-interface': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
  },
}
