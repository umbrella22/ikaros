import type { FlatConfig } from '@typescript-eslint/utils/ts-eslint'
import {
  parserOptions,
  esRules,
  settings,
  assetExtends,
  jsFileExtensions,
  ignores,
  VueVersion,
} from './common'
import path from 'node:path'
import process from 'node:process'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import eslintPluginUnicorn from 'eslint-plugin-unicorn'
import pluginImport from 'eslint-plugin-import-x'
import * as vueParser from 'vue-eslint-parser'
import eslintPluginVue from 'eslint-plugin-vue'

export const getVueEsLint = (ver: VueVersion): FlatConfig.ConfigArray => {
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
    {
      name: 'ikaros/vue-recommended',
      files: jsFileExtensions,
      languageOptions: {
        parser: vueParser,
        parserOptions,
      },
      plugins: {
        import: pluginImport,
        unicorn: eslintPluginUnicorn,
      },
      settings: {
        ...settings,

        'import-x/resolver': {
          // 如果 monorepo 则需要在用户配置覆盖此项
          alias: {
            map: [['@', path.join(process.cwd(), 'src')]],
            extensions: ['.js', '.jsx', ...assetExtends],
          },
        },
      },
      rules: {
        ...esRules,

        'vue/component-definition-name-casing': ['error', 'kebab-case'],

        'import-x/extensions': [
          'error',
          'ignorePackages',
          { js: 'never', jsx: 'never' },
        ],
      },
      ignores,
    },
  ]
}
