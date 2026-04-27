// config/user-config.ts — UserConfig 类型定义

import type {
  Plugin,
  Loader,
  ModuleFederationPluginOptions,
  DefinePluginOptions,
} from '@rspack/core'
import type { IkarosPluginAPI } from '../core/plugin-api'
import type { Command } from '../compile/compile-context'
import type {
  Pages,
  RspackExperiments,
} from '../bundler/rspack/loader-plugin-helper'
import type { CssLoaderOptions } from '../bundler/rspack/css-loaders-helper'
import type { ImportMeta } from '../../types/env'
import type { CdnPluginOptions } from '../plugins/cdn-plugin'

export type Bundler = 'rspack' | 'vite'

export interface IkarosPlugin {
  name: string
  setup: (api: IkarosPluginAPI) => void | Promise<void>
}

// ─── Library Mode ────────────────────────────────────────────────────────────

/**
 * 库模式输出格式
 * - 'es': ESM (import/export)
 * - 'cjs': CommonJS (module.exports)
 * - 'umd': Universal Module Definition
 * - 'iife': Immediately Invoked Function Expression
 */
export type LibraryFormat = 'es' | 'cjs' | 'umd' | 'iife'

/**
 * 库模式配置（仅在 build 时生效）
 *
 * 启用后 ikaros 将以库模式构建，而非应用模式。
 * 统一适配 Vite build.lib 与 Rspack output.library，
 * 切换 bundler 时无需修改配置。
 *
 * @see Vite  https://cn.vitejs.dev/guide/build#library-mode
 * @see Rspack https://rspack.rs/zh/config/output#outputlibrary
 */
export interface LibraryConfig {
  /**
   * 库入口文件路径（相对于项目根目录）
   * @example 'src/index.ts'
   * @example ['src/index.ts']
   * @example { main: 'src/index.ts', utils: 'src/utils.ts' }
   */
  entry: string | string[] | Record<string, string>

  /**
   * 库的全局变量名（UMD/IIFE 格式必须指定）
   * @example 'MyLib'
   */
  name?: string

  /**
   * 输出格式
   * - 单入口默认: ['es', 'umd']
   * - 多入口默认: ['es', 'cjs']
   */
  formats?: LibraryFormat[]

  /**
   * 输出文件名（不含扩展名），可以是固定字符串或函数
   * @default 基于 package.json 的 name 字段
   */
  fileName?: string | ((format: LibraryFormat, entryName: string) => string)

  /**
   * CSS 输出文件名
   */
  cssFileName?: string

  /**
   * 不打包的外部依赖
   * @example ['vue', 'react', /^@shared\//]
   */
  externals?: (string | RegExp)[]

  /**
   * UMD/IIFE 格式下外部依赖的全局变量映射
   * @example { vue: 'Vue', react: 'React' }
   */
  globals?: Record<string, string>
}

export interface ElectronConfig {
  main?: {
    entry?: string
    output?: string
    plugins?: Plugin | Plugin[]
    loaders?: Loader[]
  }
  preload?: {
    entries?: string[] | Record<string, string>
    output?: string
    plugins?: Plugin | Plugin[]
    loaders?: Loader[]
  }
  renderer?: {
    plugins?: Plugin | Plugin[]
    loaders?: Loader[]
  }
  build?: {
    hotReload?: boolean
    debug?: boolean
    outDir?: string
  }
}

/**
 * 这里复写了 ModuleFederationPluginOptions，因为 ModuleFederationPluginOptions 是从 module-federation/sdk 导入的，remoteType和rspack的remoteType不一样
 */
export interface ModuleFederationOptions extends Omit<
  ModuleFederationPluginOptions,
  'remoteType'
> {
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

export interface RspackConfig {
  /**
   * Rspack 插件
   * @see {@link https://rspack.dev/zh/guide/features/plugin}
   */
  plugins?: Plugin | Plugin[]

  /**
   * Rspack loader
   * @see {@link https://rspack.dev/zh/guide/features/loader}
   */
  loaders?: Loader[]

  /**
   * SWC 内置转换选项。
   * `experiments.import` 作为兼容别名保留，内部会迁移到 Rspack 2.0 的 `transformImport`。
   * @see {@link https://rspack.rs/guide/features/builtin-swc-loader#transformimport}
   */
  experiments?: RspackExperiments

  /**
   * 模块联邦
   * @see {@link https://module-federation.io/zh/blog/announcement.html}
   */
  moduleFederation?: ModuleFederationOptions | ModuleFederationOptions[]

  /**
   * CDN 配置
   */
  cdnOptions?: CdnPluginOptions

  /**
   * css loader 配置
   */
  css?: CssLoaderOptions
}

export interface ViteConfig {
  /**
   * Vite 插件
   * @see {@link https://vite.dev/guide/api-plugin}
   */
  plugins?: unknown
}

export interface UserConfig {
  /**
   * 底层打包器
   * - 'rspack': 维持现有行为（默认）
   * - 'vite': 启用 Vite（当前主要用于 Web）
   * @default 'rspack'
   */
  bundler?: Bundler

  /**
   * 框架级插件。
   * 注意：这里不是 bundler 原生插件；rspack/vite 原生插件分别放在 rspack/vite 命名空间中。
   */
  plugins?: IkarosPlugin[]

  /**
   * 静默模式，抑制非关键警告（如缺少 env 文件、页面配置等）
   * @default false
   */
  quiet?: boolean
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
   * 可选页面启动配置
   * - string[]: 只启动指定的页面
   * - false: 禁用页面选择功能，启动所有页面
   * - undefined: 默认行为，启动所有页面
   * @default undefined
   */
  enablePages?: string[] | false
  /**
   * 全局变量
   * @default {}
   */
  define?: DefinePluginOptions

  /**
   * Rspack 配置（仅 bundler = 'rspack' 时消费）
   */
  rspack?: RspackConfig

  /**
   * Vite 配置（仅 bundler = 'vite' 时消费）
   */
  vite?: ViteConfig

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
     * 服务器代理
     * - rspack 模式：同 @rspack/dev-server
     * - vite 模式：同 Vite server.proxy
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
    /**
     * 是否开启循环依赖检查
     */
    dependencyCycleCheck?: boolean
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
     * @default [".js", ".json", ".wasm",'.mjs', '.jsx', '.ts', '.tsx']
     */
    extensions?: string[]
  }
  /**
   * 库模式配置（仅在 build 时生效）
   *
   * 启用后 ikaros 将以库模式构建，而非应用模式。
   * 同一份配置在 rspack / vite 之间无缝切换。
   *
   * @example
   * ```ts
   * library: {
   *   entry: 'src/index.ts',
   *   name: 'MyLib',
   *   formats: ['es', 'umd'],
   *   externals: ['vue'],
   *   globals: { vue: 'Vue' },
   * }
   * ```
   * @see https://cn.vitejs.dev/guide/build#library-mode
   * @see https://rspack.rs/zh/config/output#outputlibrary
   */
  library?: LibraryConfig

  /**
   * Electron应用配置
   * @default undefined
   */
  electron?: ElectronConfig
}

/**
 * 经过插件 modifyIkarosConfig 修改后的用户配置。
 *
 * 结构与 UserConfig 相同，但语义上代表「已被插件处理过」的中间状态。
 * 对齐 rsbuild 三阶段模型：RawUserConfig → ResolvedUserConfig → NormalizedConfig。
 */
export type ResolvedUserConfig = UserConfig

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
