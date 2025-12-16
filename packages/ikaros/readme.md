# @ikaros-cli/ikaros 使用文档

## 平台

ikaros 支持多个运行平台：

- `web`：默认平台（本文件后续的大部分配置项均属于 web/Rspack 编译配置）
- `desktopClient`：Electron 平台（可选依赖，启用时才会从项目依赖中按需加载）

### desktopClient（Electron，可选依赖）

desktopClient 平台的编译实现位于独立包 `@ikaros-cli/ikaros-platform-desktop-client`。

当你使用 `--platform desktopClient` 运行时，请在你的业务项目中安装：

```bash
pnpm add -D @ikaros-cli/ikaros-platform-desktop-client electron
```

示例：

```bash
ikaros --platform desktopClient --mode development
ikaros build --platform desktopClient --mode release
```

如果缺少该可选依赖，ikaros 会在运行时提示你安装它。

### bundler=vite（可选依赖）

如果你选择使用 Vite bundler，仍需要额外安装可选依赖（并遵循其 Node 版本要求）：

```bash
pnpm add -D @ikaros-cli/ikaros-bundler-vite
```

---

## ikaros-web 配置项

## target

编译的平台，该值影响底层优化逻辑。

- 类型: `'pc' | 'mobile'`
- 默认值: `'pc'`
- 未来支持: 该功能受限，目前仅支持 `'pc'`

## pages

页面配置。

- 类型: `Pages`
- 默认值:

  ```json
  {
    "index": {
      "html": "path.join(context, 'index.html')",
      "entry": "path.join(context, 'src/index')"
    }
  }
  ```

## moduleFederation

模块联邦。

- 类型: `ModuleFederationOptions | ModuleFederationOptions[]`
- 默认值: `undefined`
- 参考: [Module Federation](https://module-federation.io/zh/blog/announcement.html)

## plugins

插件。

- 类型: `Plugin | Plugin[]`
- 参考: [Rspack Plugins](https://rspack.dev/zh/guide/features/plugin)

## loaders

loader。

- 类型: `Loader[]`
- 参考: [Rspack Loaders](https://rspack.dev/zh/guide/features/loader)

## experiments

RspackExperiments。

- 类型: `RspackExperiments`
- 默认值: `undefined`
- 参考: [Rspack Experiments](https://rspack.dev/zh/guide/features/builtin-swc-loader#rspackexperimentsimport)
- 参考: [Babel Plugin Import](https://www.npmjs.com/package/babel-plugin-import)

### cdnOptions

- 类型：`CdnPluginOptions`
- 默认值：`undefined`
- 说明：用于在构建过程中将外部依赖注入到 HTML 中，支持开发和生产环境使用不同的 CDN 源。
- 参考：
  - 基础配置:

```typescript
// filepath: ikaros.config.ts
import { defineConfig } from '@ikaros-cli/ikaros'

export default defineConfig({
  cdnOptions: {
    modules: [
      {
        name: 'vue', // 模块名称
        var: 'Vue', // 全局变量名
        path: 'dist/vue.runtime.min.js', // JS 文件路径
      },
      {
        name: 'element-plus',
        var: 'ElementPlus',
        path: 'dist/index.full.min.js',
        style: 'dist/index.css', // CSS 文件路径
      },
    ],
    // 可选：自定义 CDN URL 模板
    prodUrl: 'https://unpkg.com/:name@:version/:path',
    devUrl: ':name/:path',
    // 可选：启用跨域配置
    crossOrigin: 'anonymous',
  },
})
```

#### CDN 配置项说明

#### CdnModule 配置

| 参数    | 类型     | 必填 | 说明                                         |
| ------- | -------- | ---- | -------------------------------------------- |
| name    | string   | 是   | 模块名称，需与 package.json 中的名称一致     |
| var     | string   | 否   | 模块导出的全局变量名                         |
| version | string   | 否   | 指定版本号，未指定时自动从 node_modules 获取 |
| path    | string   | 否   | 主 JS 文件路径                               |
| paths   | string[] | 否   | 额外的 JS 文件路径列表                       |
| style   | string   | 否   | 主 CSS 文件路径                              |
| styles  | string[] | 否   | 额外的 CSS 文件路径列表                      |
| cssOnly | boolean  | 否   | 是否仅加载 CSS 文件                          |
| prodUrl | string   | 否   | 指定该模块的生产环境 CDN URL 模板            |
| devUrl  | string   | 否   | 指定该模块的开发环境 CDN URL 模板            |

#### 插件选项

| 参数        | 类型              | 默认值                                   | 说明                  |
| ----------- | ----------------- | ---------------------------------------- | --------------------- |
| modules     | CdnModule[]       | -                                        | CDN 模块配置列表      |
| prodUrl     | string            | <https://unpkg.com/:name@:version/:path> | 生产环境 CDN URL 模板 |
| devUrl      | string            | :name/:path                              | 开发环境 CDN URL 模板 |
| crossOrigin | boolean \| string | false                                    | 跨域资源配置          |

#### URL 模板

支持以下占位符：

- `:name` - 模块名称
- `:version` - 模块版本号
- `:path` - 资源路径

#### 使用示例

##### 基础用法

```typescript
cdnOptions: {
  modules: [
    {
      name: 'vue',
      var: 'Vue',
      path: 'dist/vue.runtime.min.js',
    },
  ]
}
```

##### 使用自定义 CDN

```typescript
cdnOptions: {
  modules: [
    {
      name: "vue",
      var: "Vue",
      path: "dist/vue.runtime.min.js",
    },
  ];
  // 仅在生产环境时生效
  prodUrl: "https://cdn.jsdelivr.net/npm/:name@:version/:path",
}
```

##### 加载多个资源

```typescript
cdnOptions: {
  modules: [
    {
      name: 'element-plus',
      var: 'ElementPlus',
      path: 'dist/index.full.min.js',
      paths: ['dist/locale/zh-cn.min.js'],
      style: 'dist/index.css',
      styles: ['dist/theme-chalk/dark.css'],
    },
  ]
}
```

##### 仅加载样式

```typescript
cdnOptions: {
  modules: [
    {
      name: 'normalize.css',
      style: 'normalize.css',
      cssOnly: true,
    },
  ]
}
```

#### 注意事项

1. 确保模块名称与 package.json 中的名称一致
2. 建议在生产环境中明确指定版本号
3. 使用自定义 CDN 时注意资源路径的正确性
4. 开发环境默认使用本地 node_modules 中的文件

## server

dev 服务相关，该对象下的值不影响生产环境。

- 类型: `object`
  - `port`: 服务器端口号，空则自动获取。
    - 类型: `number`
    - 默认值: `undefined`
  - `proxy`: webpack-server 服务器代理。
    - 类型: `import('@rspack/dev-server').Configuration['proxy']`
    - 默认值: `undefined`
    - 参考: [DevServer Proxy](https://webpack.js.org/configuration/dev-server/#devserverproxy)
  - `https`: https 配置。
    - 类型: `boolean | import('https').ServerOptions`
    - 默认值: `false`
    - 参考: [DevServer HTTPS](https://webpack.js.org/configuration/dev-server/#devserverhttps)

## css

css loader 配置。

- 类型: `CssLoaderOptions`
- 参考: [LightningCSS Options](https://rspack.dev/zh/guide/features/builtin-lightningcss-loader#%E9%80%89%E9%A1%B9)
- 参考: [Stylus Options](https://webpack.js.org/loaders/stylus-loader/#options)
- 参考: [Less Options](https://webpack.js.org/loaders/less-loader/#options)
- 参考: [Sass Options](https://webpack.js.org/loaders/sass-loader/#options)

## build

构建配置。

- 类型: `object`
  - `base`: 资源前缀，值得注意的是 `'./'` 只会被原封不动的作为所有资源的前缀，如果你想根据 html 定位应该填 `'auto'`。
    - 类型: `string`
    - 默认值: `'/'`
  - `assetsDir`: 资产包裹目录，只在生产环境下生效。
    - 类型: `string`
    - 默认值: `undefined`
  - `gzip`: 是否输出 Gzip 版，只在生产环境下生效。
    - 类型: `boolean`
    - 默认值: `false`
  - `sourceMap`: 生成映射源代码文件，只在生产环境下生效。
    - 类型: `boolean`
    - 默认值: `false`
  - `outDirName`: 输出的目录名称，只在生产环境下生效。
    - 类型: `string`
    - 默认值: `"dist"`
  - `outReport`: 是否输出打包分析报告，只在生产环境下生效。
    - 类型: `boolean`
    - 默认值: `false`
  - `cache`: 是否缓存编译结果。
    - 类型: `boolean`
    - 默认值: `false`

## resolve

resolve 配置。

- 类型: `object`
  - `alias`: 路径别名。
    - 类型: `Record<string, string>`
    - 默认值: `{'@': path.join(context,'src')}`
    - 参考: [Resolve Alias](https://webpack.js.org/configuration/resolve/#resolvealias)
  - `extensions`: 默认后缀。
    - 类型: `string[]`
    - 默认值: [".js", ".json", ".wasm",'.mjs', '.jsx', '.ts', '.tsx']
    - 参考: [Resolve Extensions](https://webpack.js.org/configuration/resolve/#resolveextensions)

## 辅助工具函数

### defineConfig

定义配置的辅助工具函数。

- 类型: `(config: UserConfigWebExport) => UserConfigWebExport`
