import {
  env,
  parserOptions,
  esRules,
  tsRules,
  dtsRules,
  ignorePatterns,
  settings,
  assetExtends,
} from './common'
import { VueVersion } from './vue-recommended'
import path from 'node:path'
import process from 'node:process'

import EslintRecommended from '@typescript-eslint/eslint-plugin'

export const getVueTsEslint = (ver: VueVersion) => ({
  parser: 'vue-eslint-parser',

  env,

  parserOptions: {
    ...parserOptions,
    parser: '@typescript-eslint/parser',
    extraFileExtensions: ['.vue'],
    ecmaFeatures: {
      jsx: true,
    },
  },

  extends: [
    ver === VueVersion.v2
      ? 'eslint:recommended'
      : 'plugin:vue/vue3-recommended',
    'plugin:@typescript-eslint/recommended',

    ver === VueVersion.v2
      ? 'plugin:vue/essential'
      : 'plugin:vue/vue3-essential',

    'plugin:import-x/recommended',
    'plugin:import-x/typescript',

    'plugin:unicorn/recommended',
    'plugin:prettier/recommended',
  ],

  settings: {
    ...settings,

    'import-x/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx'],
    },

    'import-x/resolver': {
      // 如果 monorepo 则需要在用户配置覆盖此项
      alias: {
        map: [['@', path.join(process.cwd(), 'src')]],
        extensions: ['.js', '.jsx', '.ts', '.tsx', ...assetExtends],
      },
    },
  },

  overrides: [
    {
      files: ['*.cjs', '*.mjs', '*.mts', '*.cts'],
      settings: {
        'import-x/resolver': {
          node: {},
        },
      },
    },
    {
      files: ['*.vue'],
      rules: EslintRecommended.configs['eslint-recommended'].overrides[0].rules,
    },
    {
      files: ['*.d.ts'],
      rules: dtsRules,
    },
  ],

  rules: {
    ...esRules,
    ...tsRules,

    'vue/component-definition-name-casing': ['error', 'kebab-case'],

    'import-x/extensions': [
      'error',
      'ignorePackages',
      { ts: 'never', tsx: 'never' },
    ],
  },

  ignorePatterns,
})
