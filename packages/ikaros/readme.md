# UserConfig 使用文档

`UserConfig` 接口定义了项目的配置选项，以下是各个配置项的详细说明：

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
- 未来支持: 该功能尚未实现
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
    - 默认值: `['.js', '.mjs', '.ts', '.tsx', '.vue']`
    - 参考: [Resolve Extensions](https://webpack.js.org/configuration/resolve/#resolveextensions)

## 辅助工具函数

### defineConfig

定义配置的辅助工具函数。

- 类型: `(config: UserConfigWebExport) => UserConfigWebExport`
