import { FlatConfig } from '@typescript-eslint/utils/ts-eslint'
import * as tsParser from '@typescript-eslint/parser'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import eslintPluginUnicorn from 'eslint-plugin-unicorn'
import pluginImport from 'eslint-plugin-import-x'
import tseslint from 'typescript-eslint'
import {
  parserOptions,
  dtsRules,
  tsRules,
  esRules,
  settings,
  tsFileExtensions,
  ignores,
} from './common'
import { getFiles } from './utils'

export const tsRecommended = (): FlatConfig.ConfigArray => {
  return [
    ...tseslint.configs.recommended.map((config) => {
      return {
        ...config,
        files: getFiles(config, tsFileExtensions),
      }
    }),
    {
      name: 'ikaros/recommended-ts',
      files: tsFileExtensions,
      languageOptions: {
        parser: tsParser,
        parserOptions,
      },
      plugins: {
        import: pluginImport,
        unicorn: eslintPluginUnicorn,
      },
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
      rules: {
        ...esRules,
        ...tsRules,
      },
      ignores,
    },
    {
      name: 'ikaros/recommended-d-ts',
      files: ['*.d.ts'],
      languageOptions: {
        parser: tsParser,
        parserOptions,
      },
      plugins: {
        import: pluginImport,
        unicorn: eslintPluginUnicorn,
      },
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
      rules: {
        ...dtsRules,
      },
      ignores,
    },
    eslintPluginPrettierRecommended,
  ]
}
