import { env, parserOptions, esRules, ignorePatterns, settings } from './common'

export default {
  parser: 'espree',

  env,
  parserOptions,

  extends: [
    'eslint:recommended',
    'plugin:import-x/recommended',
    'plugin:unicorn/recommended',
    'plugin:prettier/recommended',
  ],

  settings: {
    ...settings,

    'import-x/resolver': {
      node: {},
    },
  },

  rules: {
    ...esRules,

    'import-x/extensions': ['error', 'ignorePackages', { js: 'never' }],
  },

  ignorePatterns,
}
