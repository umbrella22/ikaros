import {
  env,
  parserOptions,
  esRules,
  ignorePatterns,
  settings,
  assetExtends,
} from './common'
import path from 'node:path'
import process from 'node:process'

export enum VueVersion {
  v2 = 2,
  v3,
}

export const getVueEsLint = (ver: VueVersion) => ({
  parser: 'vue-eslint-parser',

  env,

  parserOptions: {
    ...parserOptions,
    parser: 'espree',
    ecmaFeatures: {
      jsx: true,
    },
  },

  extends: [
    ver === VueVersion.v2
      ? 'eslint:recommended'
      : 'plugin:vue/vue3-recommended',

    ver === VueVersion.v2
      ? 'plugin:vue/essential'
      : 'plugin:vue/vue3-essential',

    'plugin:import/recommended',
    'plugin:unicorn/recommended',
    'plugin:prettier/recommended',
  ],

  settings: {
    ...settings,

    'import/resolver': {
      // 如果 monorepo 则需要在用户配置覆盖此项
      alias: {
        map: [['@', path.join(process.cwd(), 'src')]],
        extensions: ['.js', '.jsx', ...assetExtends],
      },
    },
  },

  overrides: [
    {
      files: ['*.cjs', '*.mjs'],
      settings: {
        'import/resolver': {
          node: {},
        },
      },
    },
  ],

  rules: {
    ...esRules,

    'vue/component-definition-name-casing': ['error', 'kebab-case'],

    'import/extensions': [
      'error',
      'ignorePackages',
      { js: 'never', jsx: 'never' },
    ],
  },

  ignorePatterns,
})
