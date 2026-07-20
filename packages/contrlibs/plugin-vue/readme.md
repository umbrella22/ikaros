# @ikaros-cli/plugin-vue

可选的 Rspack Vue SFC 支持包。它不会改变 ikaros core 的通用配置模型。

```js
import { defineConfig } from '@ikaros-cli/ikaros'
import { vue } from '@ikaros-cli/plugin-vue'

export default defineConfig({
  plugins: [vue()],
})
```

该插件要求 Vue 3，使用 `@vizejs/rspack-plugin` 编译 Vue SFC，并注册 Vize 的
loader 与 Rspack 插件。如果项目已经提供 Vize loader rule，插件不会重复添加 rule。
插件会为 Vize 内部使用的 loader 注入绝对解析路径，因此使用 pnpm 时也不需要在应用
项目中重复安装 `@vizejs/rspack-plugin`。
