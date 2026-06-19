# @ikaros-cli/ikaros-bundler-vite

Vite bundler adapter for `@ikaros-cli/ikaros`.

ikaros 默认使用 Rspack。只有当项目配置 `bundle.adapter: 'vite'` 时，core 才会从用户项目依赖中按需加载本包。

## 安装

```bash
pnpm add -D @ikaros-cli/ikaros-bundler-vite vite
```

## 配置

```js
import { defineConfig } from '@ikaros-cli/ikaros'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  bundle: {
    adapter: 'vite',
    vite: {
      plugins: [vue()],
    },
  },
})
```

## Adapter 行为

- 从 `@ikaros-cli/ikaros/adapter` 读取稳定 contract 类型。
- 消费 core 生成的 `BuildPlan`，不依赖 core 内部 `NormalizedConfig`。
- 支持应用模式和库模式。
- dev server、build runner 均由 core executor 调用。
