import {
  env,
  parserOptions,
  esRules,
  tsRules,
  ignorePatterns,
  settings,
  assetExtends,
} from './common'
import { VueVersion } from './vue-recommended'
import path from 'node:path'
import process from 'node:process'

export default (ver: VueVersion) => ({
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
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',

    ver === VueVersion.v2
      ? 'plugin:vue/essential'
      : 'plugin:vue/vue3-essential',

    'plugin:import/recommended',
    'plugin:import/typescript',

    'plugin:unicorn/recommended',
    'plugin:prettier/recommended',
  ],

  settings: {
    ...settings,

    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx'],
    },

    'import/resolver': {
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
        'import/resolver': {
          node: {},
        },
      },
    },
  ],

  rules: {
    ...esRules,
    ...tsRules,

    'vue/component-definition-name-casing': ['error', 'kebab-case'],

    'import/extensions': [
      'error',
      'ignorePackages',
      { ts: 'never', tsx: 'never' },
    ],
  },

  ignorePatterns,
})
