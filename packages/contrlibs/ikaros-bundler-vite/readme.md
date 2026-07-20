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

## 原生 Vite 高级出口

核心包不依赖 Vite 类型。需要完整类型提示时，从本包导入 `defineViteConfig`：

```js
import { defineConfig } from '@ikaros-cli/ikaros'
import { defineViteConfig } from '@ikaros-cli/ikaros-bundler-vite'

export default defineConfig({
  bundle: {
    adapter: 'vite',
    vite: {
      config: defineViteConfig({
        server: { host: '127.0.0.1' },
        build: { target: 'esnext' },
      }),
      configFile: './vite.config.ts',
    },
  },
})
```

`vite.config` 覆盖生成的 Vite 配置。`configFile` 默认为 `false`，只有显式配置后才
加载原生 `vite.config.*`。这两个字段适合 Vite 特有能力；跨 bundler 配置继续使用
ikaros 的 `source`、`dev`、`output` 与 `library` 命名空间。开发服务会监听显式
`configFile` 并在变更后重启。

## Adapter 行为

- 从 `@ikaros-cli/ikaros/adapter` 读取稳定 contract 类型。
- 消费 core 生成的 `BuildPlan`，不依赖 core 内部 `NormalizedConfig`。
- 支持应用模式和库模式。
- 应用模式与库模式都会应用 gzip、报告和循环依赖检查。
- dev server、build runner 均由 core executor 调用。
