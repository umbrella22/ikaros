import {
  env,
  parserOptions,
  tsRules,
  esRules,
  ignorePatterns,
  settings,
} from './common'

export default {
  parser: '@typescript-eslint/parser',

  env,

  parserOptions,

  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:unicorn/recommended',
    'plugin:prettier/recommended',
  ],

  settings: {
    ...settings,

    'import/parsers': {
      '@typescript-eslint/parser': ['.ts'],
    },

    'import/resolver': {
      node: {},

      typescript: {
        project: '**/tsconfig.json',
      },
    },
  },

  rules: {
    ...esRules,
    ...tsRules,

    'import/extensions': ['error', 'ignorePackages', { ts: 'never' }],
  },

  ignorePatterns,
}
