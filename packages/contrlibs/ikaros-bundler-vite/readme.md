# @ikaros-cli/ikaros-bundler-vite

`@ikaros-cli/ikaros` 的 Vite bundler 适配器（可选依赖）。

> 默认情况下 ikaros 使用 Rspack。本包仅在你显式选择 `bundler: 'vite'` 时才需要安装与使用。

## 使用前提

- Node.js `>= 22`
- 项目中已安装 `@ikaros-cli/ikaros`

## 安装

```bash
pnpm add -D @ikaros-cli/ikaros @ikaros-cli/ikaros-bundler-vite
```

## 启用（示例）

在你的 `ikaros.config.(ts|js|mjs)` 中选择 Vite：

```ts
import { defineConfig } from '@ikaros-cli/ikaros'

export default defineConfig({
  bundler: 'vite',
})
```

然后正常使用 ikaros：

```bash
ikaros --mode development
ikaros build --mode release
```

## 说明

- 如果未安装本包但配置了 `bundler: 'vite'`，ikaros 会在运行时提示你安装它。
