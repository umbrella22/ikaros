# @ikaros-cli/eslint-plugin

how to use

Requires ESLint >= 10.4.0. The package uses the TypeScript 6 compiler API for
parsing, independently of the TypeScript compiler used to build the project.

eslint.config.mjs

```js
import { ikarosEslintRule } from '@ikaros-cli/eslint-plugin'
export default [
  {
    ignores: ['**/dist', '**/node_modules'],
  },
  ...ikarosEslintRule.configs.tsRecommended(),
]
```
