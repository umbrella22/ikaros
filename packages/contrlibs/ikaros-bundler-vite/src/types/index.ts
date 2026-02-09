import type { ServerOptions as HttpsServerOptions } from 'node:https'
import type { PluginOption, ProxyOptions } from 'vite'

// ─── 基础类型 ─────────────────────────────────────────────────────────────

export type Command = 'server' | 'build'

export type Pages = Record<
  string,
  {
    html: string
    entry: string
  }
>

// ─── BuildStatus（与主包 bundler/types.ts 对齐）──────────────────────────

export interface BuildStatus {
  success: boolean
  message?: string
  port?: number
  /** 预留多目标结构（web / renderer / main / preload） */
  target?: 'web' | 'renderer' | 'main' | 'preload'
}

// ─── BundlerAdapter 接口（结构兼容主包 bundler/types.ts）─────────────────

/**
 * 编译器适配器接口
 *
 * 泛型参数 TConfig 默认为 unknown，core 层按 BundlerAdapter（即 BundlerAdapter<unknown>）对待；
 * adapter 实现内部可指定具体类型以获得强类型约束。
 * 例如：class ViteBundlerAdapter implements BundlerAdapter<InlineConfig> { ... }
 */
export interface BundlerAdapter<TConfig = unknown> {
  /** 编译器标识 */
  readonly name: 'rspack' | 'vite'

  /** 根据编译参数生成编译器配置 */
  createConfig(params: CreateConfigParams): TConfig | Promise<TConfig>

  /** 启动开发服务器 */
  runDev(config: TConfig, options: BundlerDevOptions): Promise<void>

  /** 执行生产构建 */
  runBuild(
    config: TConfig,
    options: BundlerBuildOptions,
  ): Promise<string | undefined>
}

export interface BundlerDevOptions {
  port?: number
  onBuildStatus?: (status: BuildStatus) => void
}

export interface BundlerBuildOptions {
  onBuildStatus?: (status: BuildStatus) => void
}

// ─── CreateConfigParams（与主包 CreateConfigParams 对齐）─────────────────

export interface CreateConfigParams {
  command: Command
  mode?: string
  env: Record<string, unknown>
  context: string
  contextPkg?: { name: string; version: string }
  userConfig?: ViteUserConfigSubset
  pages: Pages
  base: string
  port: number
  /** browserslist 查询字符串（预留，Vite 7+ 可原生支持） */
  browserslist?: string
  isElectron: boolean
  isVue?: boolean
  isReact?: boolean
  resolveContext: (...paths: string[]) => string
}

// ─── 用户配置子集（Vite bundler 关心的字段）──────────────────────────────

export type ViteUserConfigSubset = {
  enablePages?: string[] | false
  define?: Record<string, unknown>
  resolve?: {
    alias?: Record<string, string>
    extensions?: string[]
  }
  server?: {
    port?: number
    proxy?: Record<string, string | ProxyOptions>
    https?: boolean | HttpsServerOptions
  }
  build?: {
    base?: string
    assetsDir?: string
    gzip?: boolean
    sourceMap?: boolean
    outDirName?: string
    outReport?: boolean
    /** 编译缓存（预留，与主包 UserConfig 对齐） */
    cache?: boolean
    dependencyCycleCheck?: boolean
  }
  vite?: {
    plugins?: PluginOption | PluginOption[]
  }
}
