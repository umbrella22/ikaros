# @ikaros-cli/eslint-plugin

how to use

only eslint9

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
