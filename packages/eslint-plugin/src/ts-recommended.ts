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
    'plugin:import-x/recommended',
    'plugin:import-x/typescript',
    'plugin:unicorn/recommended',
    'plugin:prettier/recommended',
  ],

  settings: {
    ...settings,

    'import-x/parsers': {
      '@typescript-eslint/parser': ['.ts'],
    },

    'import-x/resolver': {
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

    'import-x/extensions': ['error', 'ignorePackages', { ts: 'never' }],
  },

  ignorePatterns,
}
