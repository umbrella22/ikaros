import type {
  Plugin,
  Loader,
  ModuleFederationPluginOptions,
  DefinePluginOptions,
} from '@rspack/core'
import type { Command } from './compile/base-compile-service'
import type { Pages, RspackExperiments } from './utils/loader-plugin-helper'
import type { CssLoaderOptions } from './utils/css-loaders-helper'
import type { ImportMeta } from '../types/env'
import type { CdnPluginOptions } from './plugins/cdn-plugin'

/**
 * 这里复写了 ModuleFederationPluginOptions，因为 ModuleFederationPluginOptions 是从 module-federation/sdk 导入的，remoteType和rspack的remoteType不一样
 */
export interface ModuleFederationOptions
  extends Omit<ModuleFederationPluginOptions, 'remoteType'> {
  remoteType?:
    | 'var'
    | 'module'
    | 'assign'
    | 'this'
    | 'window'
    | 'self'
    | 'global'
    | 'commonjs'
    | 'commonjs2'
    | 'commonjs-module'
    | 'commonjs-static'
    | 'amd'
    | 'amd-require'
    | 'umd'
    | 'umd2'
    | 'jsonp'
    | 'system'
    | 'promise'
    | 'import'
    | 'script'
    | 'module-import'
    | 'node-commonjs'
}
export interface UserConfig {
  /**
   * 编译的平台，该值影响底层优化逻辑
   * @default 'pc'
   * @future 该功能受限，目前仅支持 'pc'
   */
  target?: 'pc' | 'mobile'
  /**
   * 页面配置
   * @default
   * {
   *  index: {
   *    html: path.join(context, 'index.html'),
   *    entry: path.join(context, 'src/index')
   *  }
   * }
   */
  pages?: Pages
  /**
   * 全局变量
   * @default {}
   */
  define?: DefinePluginOptions
  /**
   * 模块联邦
   * @see {@link https://module-federation.io/zh/blog/announcement.html}
   * @default undefined
   */
  moduleFederation?: ModuleFederationOptions | ModuleFederationOptions[]
  /**
   * 插件
   * @see {@link https://rspack.dev/zh/guide/features/plugin}
   */
  plugins?: Plugin | Plugin[]
  /**
   * loader
   * @see {@link https://rspack.dev/zh/guide/features/loader}
   */
  loaders?: Loader[]
  /**
   * RspackExperiments
   * @default undefined
   * @see {@link https://rspack.dev/zh/guide/features/builtin-swc-loader#rspackexperimentsimport}
   * @see {@link rules https://www.npmjs.com/package/babel-plugin-import}
   */
  experiments?: RspackExperiments
  /**
   * cdn配置
   * @default undefined
   * @see {@link https://www.npmjs.com/package/webpack-cdn-plugin}
   */
  cdnOptions?: CdnPluginOptions
  /**
   * dev 服务相关 该对象下的值不影响 生产环境
   */
  server?: {
    /**
     * 服务器端口号 空则自动获取
     * @default undefined
     */
    port?: number

    /**
     * webpack-server 服务器代理
     * @see {@link https://webpack.js.org/configuration/dev-server/#devserverproxy}
     * @default undefined
     */
    proxy?: import('@rspack/dev-server').Configuration['proxy']

    /**
     * https
     * @see {@link https://webpack.js.org/configuration/dev-server/#devserverhttps}
     * @default false
     */
    https?: boolean | import('https').ServerOptions
  }
  /**
   * css loader 配置
   * @see {@link lightningcssOptions https://rspack.dev/zh/guide/features/builtin-lightningcss-loader#%E9%80%89%E9%A1%B9}
   * @see {@link stylusOptions https://webpack.js.org/loaders/stylus-loader/#options}
   * @see {@link lessOptions https://webpack.js.org/loaders/less-loader/#options}
   * @see {@link sassOptions https://webpack.js.org/loaders/sass-loader/#options}
   */
  css?: CssLoaderOptions
  /**
   * 构建配置
   */
  build?: {
    /**
     * 资源前缀，值得注意的是 './' 只会被原封不动的作为所有资源的前缀，如果你想根据html定位应该填 'auto'
     * @default '/'
     */
    base?: string

    /**
     * 资产包裹目录，只在生产环境下生效
     * @default undefined
     */
    assetsDir?: string

    /**
     * 是否输出Gzip版，只在生产环境下生效
     * @default false
     */
    gzip?: boolean

    /**
     * 生成映射源代码文件，只在生产环境下生效
     * @default false
     */
    sourceMap?: boolean

    /**
     * 输出的目录名称，只在生产环境下生效
     * @default "dist"
     */
    outDirName?: string

    /**
     * 是否输出打包分析报告，只在生产环境下生效
     * @default false
     */
    outReport?: boolean

    /**
     * 是否缓存编译结果
     * @default false
     */
    cache?: boolean
  }
  /**
   * resolve
   */
  resolve?: {
    /**
     * 路径别名
     * @see {@link https://webpack.js.org/configuration/resolve/#resolvealias}
     * @default {'@': path.join(context,'src')}
     */
    alias?: Record<string, string>

    /**
     * 默认后缀
     * @see {@link https://webpack.js.org/configuration/resolve/#resolveextensions}
     * @default ['.js', '.mjs', '.ts', '.tsx', '.vue']
     */
    extensions?: string[]
  }
}

export type ConfigEnvPre = Readonly<{
  mode: string
  env: Omit<ImportMeta['env'], 'BASE'>
  command: Command
}>
export type UserConfigFn<C> = (envPre: ConfigEnvPre) => C | Promise<C>

export type UserConfigWebExport =
  | UserConfig
  | Promise<UserConfig>
  | UserConfigFn<UserConfig>

/** 辅助工具函数 */
export const defineConfig = (config: UserConfigWebExport) => config
