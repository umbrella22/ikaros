// config/user-config.ts — UserConfig 类型定义

import type {
  Plugin,
  Loader,
  ModuleFederationPluginOptions,
  DefinePluginOptions,
  SwcLoaderOptions,
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
  enforce?: 'pre' | 'post'
  order?: number
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
    inspectPort?: number
    electronArgs?: string[]
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
   * 内置 `builtin:swc-loader` 的转换选项,深合并进所有脚本(ts/tsx/js/jsx)规则。
   *
   * ikaros 只负责按文件扩展名设置必要的 `jsc.parser`(如 tsx 的 `jsx: true`),
   * 不替你决定任何框架相关的转换。React 项目需在此显式提供 react 变换,例如:
   *
   * ```ts
   * bundle: { rspack: { swc: { jsc: { transform: { react: {
   *   runtime: 'automatic',
   *   development: true,  // 仅 dev
   *   refresh: true,      // 仅 dev，需配套 @rspack/plugin-react-refresh
   * } } } } } }
   * ```
   *
   * Vue / 非 React 项目不提供 react 变换即可,不会被强加 React JSX 语义。
   * @see {@link https://rspack.rs/guide/features/builtin-swc-loader}
   */
  swc?: SwcLoaderOptions

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
  cdn?: CdnPluginOptions

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

  /**
   * 原生 Vite InlineConfig 高级出口。
   *
   * 该对象在 ikaros 生成的配置之后合并，因此可以覆盖底层 Vite 选项。
   * 如需类型提示，可从 @ikaros-cli/ikaros-bundler-vite 导入
   * `defineViteConfig`。
   */
  config?: Record<string, unknown>

  /**
   * 可选的原生 vite.config.* 文件。默认不加载，避免隐式引入第二套配置源。
   */
  configFile?: string | false
}

export interface AppConfig {
  target?: 'pc' | 'mobile'
}

export interface LogConfig {
  level?: 'normal' | 'quiet'
}

export interface BundleConfig {
  /**
   * 底层打包器。
   * @default 'rspack'
   */
  adapter?: Bundler
  rspack?: RspackConfig
  vite?: ViteConfig
}

export interface SourceConfig {
  define?: DefinePluginOptions
  alias?: Record<string, string>
  extensions?: string[]
}

export interface DevConfig {
  port?: number
  proxy?: import('@rspack/dev-server').Configuration['proxy']
  https?: boolean | import('https').ServerOptions
  pages?: string[] | false
}

export interface OutputConfig {
  base?: string
  assetsDir?: string
  gzip?: boolean
  sourceMap?: boolean
  dir?: string
  report?: boolean
  cache?: boolean
  checkCycles?: boolean
}

export interface UserConfig {
  app?: AppConfig
  log?: LogConfig
  plugins?: IkarosPlugin[]
  bundle?: BundleConfig
  source?: SourceConfig
  pages?: Pages
  dev?: DevConfig
  output?: OutputConfig
  library?: LibraryConfig
  electron?: ElectronConfig
}

export interface LegacyRspackConfig extends Omit<RspackConfig, 'cdn'> {
  cdnOptions?: CdnPluginOptions
}

export interface LegacyUserConfig {
  bundler?: Bundler
  plugins?: IkarosPlugin[]
  quiet?: boolean
  target?: 'pc' | 'mobile'
  pages?: Pages
  enablePages?: string[] | false
  define?: DefinePluginOptions
  rspack?: LegacyRspackConfig
  vite?: ViteConfig
  server?: DevConfig
  build?: {
    base?: string
    assetsDir?: string
    gzip?: boolean
    sourceMap?: boolean
    outDirName?: string
    outReport?: boolean
    cache?: boolean
    dependencyCycleCheck?: boolean
  }
  resolve?: {
    alias?: Record<string, string>
    extensions?: string[]
  }
  library?: LibraryConfig
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

export interface MigrateLegacyConfigResult {
  config: UserConfig
  diagnostics: string[]
}

export function migrateLegacyConfig(
  legacy: LegacyUserConfig,
): MigrateLegacyConfigResult {
  const diagnostics: string[] = []
  const output: OutputConfig = {
    base: legacy.build?.base,
    assetsDir: legacy.build?.assetsDir,
    gzip: legacy.build?.gzip,
    sourceMap: legacy.build?.sourceMap,
    dir: legacy.build?.outDirName,
    report: legacy.build?.outReport,
    cache: legacy.build?.cache,
    checkCycles: legacy.build?.dependencyCycleCheck,
  }

  const config: UserConfig = {
    app: legacy.target ? { target: legacy.target } : undefined,
    log: legacy.quiet ? { level: 'quiet' } : undefined,
    plugins: legacy.plugins,
    bundle:
      legacy.bundler || legacy.rspack || legacy.vite
        ? {
            adapter: legacy.bundler,
            rspack: legacy.rspack
              ? {
                  ...legacy.rspack,
                  cdn: legacy.rspack.cdnOptions,
                }
              : undefined,
            vite: legacy.vite,
          }
        : undefined,
    source:
      legacy.define || legacy.resolve
        ? {
            define: legacy.define,
            alias: legacy.resolve?.alias,
            extensions: legacy.resolve?.extensions,
          }
        : undefined,
    pages: legacy.pages,
    dev:
      legacy.server || legacy.enablePages !== undefined
        ? {
            ...legacy.server,
            pages: legacy.enablePages,
          }
        : undefined,
    output: Object.values(output).some((value) => value !== undefined)
      ? output
      : undefined,
    library: legacy.library,
    electron: legacy.electron,
  }

  diagnostics.push('已将 v2 配置字段迁移到 v3 语义配置结构。')
  if (legacy.rspack?.cdnOptions) {
    diagnostics.push('rspack.cdnOptions 已迁移为 bundle.rspack.cdn。')
  }

  return { config, diagnostics }
}

/** 辅助工具函数 */
export const defineConfig = (config?: UserConfigWebExport) => config
