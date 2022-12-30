import { env, parserOptions, esRules, ignorePatterns, settings } from './common'

export default {
  parser: 'espree',

  env,
  parserOptions,

  extends: [
    'eslint:recommended',
    'plugin:import/recommended',
    'plugin:unicorn/recommended',
    'plugin:prettier/recommended',
  ],

  settings: {
    ...settings,

    'import/resolver': {
      node: {},
    },
  },

  rules: {
    ...esRules,

    'import/extensions': ['error', 'ignorePackages', { js: 'never' }],
  },

  ignorePatterns,
}
