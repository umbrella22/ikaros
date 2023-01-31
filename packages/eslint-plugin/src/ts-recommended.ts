import {
  env,
  parserOptions,
  tsRules,
  esRules,
  dtsRules,
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

  overrides: [
    {
      files: ['*.d.ts'],
      rules: dtsRules,
    },
  ],

  rules: {
    ...esRules,
    ...tsRules,

    'import/extensions': ['error', 'ignorePackages', { ts: 'never' }],
  },

  ignorePatterns,
}
