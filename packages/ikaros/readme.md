# @ikaros-cli/ikaros

`@ikaros-cli/ikaros` 是 ikaros 的核心包，包含 CLI、配置系统、插件系统、默认 Rspack adapter、BuildPlan executor、inspect 和 watchdog。

Vite 与 Electron 不内置在核心包中。需要时安装 `packages/contrlibs` 下发布的可选包，ikaros 会从用户项目依赖中懒加载它们。

ikaros 面向通用前端工程：默认配置只覆盖跨框架的构建基础，尽量降低新项目的启动心智；当项目需要更细的 bundler 能力时，`bundle.rspack`、`bundle.vite` 和插件 hook 会保留原生配置出口。

## 安装

```bash
pnpm add -D @ikaros-cli/ikaros
```

## CLI

开发服务：

```bash
pnpm exec ikaros --mode development
```

生产构建：

```bash
pnpm exec ikaros build --mode release
```

检查配置：

```bash
pnpm exec ikaros inspect -o ikaros.inspect.json
```

迁移 v2 配置：

```bash
pnpm exec ikaros migrate-config --config ./ikaros.config.mjs
pnpm exec ikaros migrate-config --config ./ikaros.config.mjs --write
pnpm exec ikaros migrate-config --config ./ikaros.config.mjs --output ./ikaros.config.v3.mjs
```

通用参数：

| 参数 | 说明 |
| --- | --- |
| `-m, --mode <name>` | 运行模式，影响 env 文件和插件上下文 |
| `-p, --platform <type>` | 平台，`web` 或 `desktopClient` |
| `-c, --config <file>` | 指定配置文件 |

## v3 配置

`defineConfig` 不要求写完整 schema。没有配置的字段会使用 CLI 内部默认值；只有需要改变默认行为时再写对应命名空间：

```js
import { defineConfig } from '@ikaros-cli/ikaros'

export default defineConfig({
  dev: {
    port: 3000,
  },
  output: {
    sourceMap: true,
  },
})
```

Vite 高级出口：

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

`vite.config` 在生成的 ikaros Vite 配置之后合并，可覆盖底层 Vite 选项。`configFile`
默认是 `false`；设置后会将指定的原生 Vite 配置文件交给 Vite 加载。`inspect` 输出
最终 Vite 配置和 watch plan；开发服务会在该文件变更后重启。

Rspack 的 React/Vue 支持由可选插件提供：

```js
import { defineConfig } from '@ikaros-cli/ikaros'
import { react } from '@ikaros-cli/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

```js
import { defineConfig } from '@ikaros-cli/ikaros'
import { vue } from '@ikaros-cli/plugin-vue'

export default defineConfig({
  plugins: [vue()],
})
```

常见可配置命名空间：

| 字段 | 用途 |
| --- | --- |
| `app` | 应用目标，例如 `target: 'mobile'` |
| `bundle` | 选择 Rspack/Vite，并传入对应 adapter 配置 |
| `source` | define、alias、extensions |
| `pages` | 多页面 html 与 entry |
| `dev` | dev server 端口、代理、https、启用页面 |
| `output` | base、输出目录、source map、gzip、报告等 |
| `library` | 库模式 |
| `electron` | desktopClient 平台配置 |

配置函数：

```js
export default defineConfig(({ mode, env, command }) => ({
  source: {
    define: {
      __APP_MODE__: JSON.stringify(mode),
      __API_HOST__: JSON.stringify(env.API_HOST ?? ''),
      __COMMAND__: JSON.stringify(command),
    },
  },
}))
```

环境变量加载顺序遵循 `.env`、`.env.local`、`.env.${mode}`、`.env.${mode}.local` 逐级覆盖；如果 shell/CI 已经存在同名变量，则以 shell/CI 的值为准，且不会被 `.env` 文件覆盖。

最终环境变量会注入为 `import.meta.env.KEY`：

```js
console.log(import.meta.env.API_HOST)
```

`source.define` 只用于裸常量替换，不会自动挂到 `import.meta.env`：

```js
if (__APP_MODE__ === 'release') {
  // ...
}
```

## 页面与入口

未配置 `pages` 时，默认使用：

```text
index.html
src/index
```

多页面：

```js
export default defineConfig({
  pages: {
    index: {
      html: './index.html',
      entry: './src/index',
    },
    admin: {
      html: './admin.html',
      entry: './src/admin',
    },
  },
  dev: {
    pages: ['index'],
  },
})
```

## Rspack

Rspack 是默认 bundler。常规项目不需要显式配置 loader；需要扩展时，原生 loader 和 plugin 放在 `bundle.rspack`：

```js
import { defineConfig } from '@ikaros-cli/ikaros'
import { VizePlugin } from '@vizejs/rspack-plugin'

export default defineConfig({
  bundle: {
    rspack: {
      loaders: [
        {
          test: /\.vue$/,
          loader: '@vizejs/rspack-plugin/loader',
        },
      ],
      plugins: [new VizePlugin()],
    },
  },
})
```

SWC：

ikaros 内置 `builtin:swc-loader`，默认只根据扩展名设置必要的 parser，例如 `.tsx` 会启用 TypeScript 和 JSX 解析。ikaros 不会根据 React/Vue 等框架自动注入框架专属 transform。

需要精细控制 SWC 时，可以通过 `bundle.rspack.swc` 透传原生选项；这些选项会深合并到默认脚本规则：

```js
export default defineConfig(({ command }) => ({
  bundle: {
    rspack: {
      swc: {
        jsc: {
          transform: {
            react: {
              runtime: 'automatic',
              development: command === 'server',
              refresh: command === 'server',
            },
          },
        },
      },
    },
  },
}))
```

CDN：

```js
export default defineConfig({
  bundle: {
    rspack: {
      cdn: {
        modules: [
          {
            name: 'vue',
            var: 'Vue',
            path: 'dist/vue.runtime.min.js',
          },
        ],
      },
    },
  },
})
```

## Vite

安装可选包：

```bash
pnpm add -D @ikaros-cli/ikaros-bundler-vite vite
```

配置：

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

## 库模式

```js
export default defineConfig({
  library: {
    entry: 'src/index.ts',
    name: 'MyLibrary',
    formats: ['es', 'umd'],
    fileName: 'my-library',
    externals: ['vue'],
    globals: {
      vue: 'Vue',
    },
  },
})
```

## Electron

安装可选包：

```bash
pnpm add -D @ikaros-cli/ikaros-platform-desktop-client electron
```

运行：

```bash
pnpm exec ikaros --platform desktopClient --mode development
pnpm exec ikaros build --platform desktopClient --mode release
```

desktopClient 平台生成三个 BuildPlan：

| Plan | Bundler |
| --- | --- |
| `electron-main` | `rspack` |
| `electron-preload` | `rspack` |
| `electron-renderer` | `bundle.adapter` |

## Inspect

`inspect` 使用与真实编译相同的配置流程，但不会启动 dev server 或 build：

```bash
pnpm exec ikaros inspect -o ikaros.inspect.json
```

输出包含：

- raw config
- current config
- normalized config
- BuildPlan 列表
- 每个 plan 的 bundler config
- 插件 hook trace
- plan provenance
- adapter capability matrix 与启用但不支持的配置告警
- env 与 watchdog 诊断

## 插件

```ts
import type { IkarosPlugin } from '@ikaros-cli/ikaros/plugin'

export const plugin: IkarosPlugin = {
  name: 'example-plugin',
  enforce: 'pre',
  order: 0,
  setup(api) {
    api.modifyBuildPlan((plan) => {
      return {
        ...plan,
        output: {
          ...plan.output,
          sourceMap: true,
        },
      }
    })
  },
}
```

推荐 hook 顺序：

```text
modifyIkarosConfig
→ platform.createPlans
→ modifyBuildPlans
→ modifyBuildPlan
→ bundler.createConfig
→ modifyRspackRules / modifyRspackPlugins
→ modifyRspackConfig / modifyViteConfig
```

插件排序：

```text
内置 pre → 用户 pre → 普通 → 用户 post → 内置 post
```

同组内按 `order` 和注册顺序排序。

推荐优先使用：

- `modifyBuildPlans`
- `modifyBuildPlan`
- `modifyRspackRules`
- `modifyRspackPlugins`

高级出口：

- `modifyRspackConfig`
- `modifyViteConfig`

底层 bundler config hook 会让插件直接依赖 Rspack/Vite 配置形状，适合少数必须改最终配置的场景。

## 子路径入口

```ts
import { defineConfig } from '@ikaros-cli/ikaros/config'
import type { IkarosPlugin } from '@ikaros-cli/ikaros/plugin'
import type { BuildPlan, BundlerAdapter } from '@ikaros-cli/ikaros/adapter'
```

公开入口：

| 入口 | 用途 |
| --- | --- |
| `@ikaros-cli/ikaros` | 常用用户 API |
| `@ikaros-cli/ikaros/config` | 配置与迁移工具 |
| `@ikaros-cli/ikaros/plugin` | 插件作者 API |
| `@ikaros-cli/ikaros/adapter` | optional adapter/platform 契约 |
| `@ikaros-cli/ikaros/testing` | 测试辅助 |

## v2 到 v3 字段映射

| v2 字段 | v3 字段 |
| --- | --- |
| `target` | `app.target` |
| `quiet` | `log.level = 'quiet'` |
| `bundler` | `bundle.adapter` |
| `define` | `source.define` |
| `resolve.alias` | `source.alias` |
| `resolve.extensions` | `source.extensions` |
| `enablePages` | `dev.pages` |
| `server` | `dev` |
| `build.base` | `output.base` |
| `build.outDirName` | `output.dir` |
| `build.outReport` | `output.report` |
| `build.dependencyCycleCheck` | `output.checkCycles` |
| `rspack` | `bundle.rspack` |
| `rspack.cdnOptions` | `bundle.rspack.cdn` |
| `vite` | `bundle.vite` |

旧字段会被 v3 schema 拒绝，并输出迁移建议。
