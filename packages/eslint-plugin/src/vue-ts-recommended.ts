import {
  parserOptions,
  esRules,
  tsRules,
  settings,
  assetExtends,
  VueVersion,
  ignores,
  tsFileExtensions,
} from './common'
import path from 'node:path'
import process from 'node:process'

import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import eslintPluginUnicorn from 'eslint-plugin-unicorn'
import pluginImport from 'eslint-plugin-import-x'
import tseslint from 'typescript-eslint'
import type { FlatConfig } from '@typescript-eslint/utils/dist/ts-eslint'
import * as vueParser from 'vue-eslint-parser'
import eslintPluginVue from 'eslint-plugin-vue'
import { getFiles } from './utils'

export const getVueTsEslint = (ver: VueVersion): FlatConfig.ConfigArray => {
  const eslintPluginVueRecommended =
    ver === VueVersion.v2
      ? eslintPluginVue.configs['flat/vue2-recommended']
      : eslintPluginVue.configs['flat/recommended']
  const eslintPluginVueEssential =
    ver === VueVersion.v2
      ? eslintPluginVue.configs['flat/vue2-essential']
      : eslintPluginVue.configs['flat/essential']
  return [
    eslintPluginPrettierRecommended,
    ...eslintPluginVueRecommended,
    ...eslintPluginVueEssential,
    ...tseslint.configs.recommended.map((config) => {
      return {
        ...config,
        files: getFiles(config, tsFileExtensions),
      }
    }),
    {
      name: 'ikaros/vue-ts-recommended',
      files: tsFileExtensions,
      languageOptions: {
        parser: vueParser,
        parserOptions: {
          ...parserOptions,
          parser: '@typescript-eslint/parser',
          extraFileExtensions: ['.vue'],
          ecmaFeatures: {
            jsx: true,
          },
        },
      },
      plugins: {
        import: pluginImport,
        unicorn: eslintPluginUnicorn,
      },
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
      rules: {
        ...esRules,
        ...tsRules,

        'vue/component-definition-name-casing': ['error', 'kebab-case'],
      },
      ignores,
    },
  ]
}
