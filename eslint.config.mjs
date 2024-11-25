import { ikarosEslintRule } from '@ikaros-cli/eslint-plugin'
export default [
  {
    ignores: ['**/dist', '**/node_modules'],
  },
  ...ikarosEslintRule.configs.tsRecommended(),
]
