# @ikaros-cli/plugin-react

可选的 Rspack React 支持包。它不会改变 ikaros core 的通用配置模型。

```js
import { defineConfig } from '@ikaros-cli/ikaros'
import { react } from '@ikaros-cli/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

该插件提供 automatic JSX runtime，并在开发模式启用 React Fast Refresh。已有
`bundle.rspack.swc.jsc.transform.react` 配置会覆盖插件默认值。
