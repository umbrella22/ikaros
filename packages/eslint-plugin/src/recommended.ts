import type { FlatConfig } from '@typescript-eslint/utils/ts-eslint'

import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import eslintPluginUnicorn from 'eslint-plugin-unicorn'
import pluginImport from 'eslint-plugin-import-x'
import { esRules, settings, jsFileExtensions, ignores } from './common'

export const recommended = (): FlatConfig.ConfigArray => {
  return [
    {
      name: 'ikaros/recommended-imports',
      files: jsFileExtensions,
      plugins: {
        import: pluginImport,
        unicorn: eslintPluginUnicorn,
      },
      settings: {
        ...settings,

        'import-x/resolver': {
          node: {},
        },
      },
      rules: {
        ...esRules,
      },
      ignores,
    },
    eslintPluginPrettierRecommended,
  ]
}
