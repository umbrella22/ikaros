# ikaros

ikaros 是一个以 Rspack 为默认引擎的前端构建工具。它提供统一的配置文件、插件系统、可检查的构建计划，以及按需接入的 Vite 和 Electron 能力。

ikaros 的配置原则是：默认路径尽量低心智，常规项目少写配置即可运行；高级路径保留底层能力，熟悉 bundler 的用户可以继续透传 Rspack/Vite/SWC 等原生配置。

## 特性

- 默认使用 Rspack，适合应用和库构建。
- 可选 Vite adapter，通过独立包按需加载。
- 可选 Electron desktopClient platform，main/preload 固定 Rspack，renderer 跟随用户选择的 bundler。
- v3 语义化配置：`app`、`bundle`、`source`、`dev`、`output` 等命名空间清晰分层。
- `inspect` 输出 normalized config、BuildPlan、bundler config 与插件修改链路。
- 插件优先使用 BuildPlan 和语义 Rspack rule/plugin API，底层 bundler config hook 作为高级出口。

## 安装

```bash
pnpm add -D @ikaros-cli/ikaros
```

要求：

- Node.js >= 22.12.0
- pnpm >= 9.5.0

## 快速开始

创建 `ikaros.config.mjs`：

```js
import { defineConfig } from '@ikaros-cli/ikaros'

export default defineConfig({
  // 只有需要修改默认值时才写配置。
  // 不配置时默认使用 Rspack、3000 端口、dist 输出目录。
})
```

启动开发服务：

```bash
pnpm exec ikaros --mode development
```

构建生产产物：

```bash
pnpm exec ikaros build --mode release
```

检查配置链路：

```bash
pnpm exec ikaros inspect -o ikaros.inspect.json
```

## 使用 Vite

Vite 是可选 adapter。需要时在项目中安装：

```bash
pnpm add -D @ikaros-cli/ikaros-bundler-vite vite
```

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

## 使用 Electron

Electron 由可选 platform 包提供：

```bash
pnpm add -D @ikaros-cli/ikaros-platform-desktop-client electron
```

```bash
pnpm exec ikaros --platform desktopClient --mode development
pnpm exec ikaros build --platform desktopClient --mode release
```

desktopClient 会生成三个 BuildPlan：

- `electron-main`：Rspack
- `electron-preload`：Rspack
- `electron-renderer`：跟随 `bundle.adapter`

## 迁移 v2 配置

v3 不兼容 v2 顶层字段。可以先 dry-run：

```bash
pnpm exec ikaros migrate-config --config ./ikaros.config.mjs
```

写回原文件：

```bash
pnpm exec ikaros migrate-config --config ./ikaros.config.mjs --write
```

输出到新文件：

```bash
pnpm exec ikaros migrate-config --config ./ikaros.config.mjs --output ./ikaros.config.v3.mjs
```

更多配置、插件和迁移说明见 [packages/ikaros/readme.md](packages/ikaros/readme.md)。
