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

// ─── Library Mode（与主包 user-config.ts 对齐）─────────────────────────────

export type LibraryFormat = 'es' | 'cjs' | 'umd' | 'iife'

export interface LibraryConfig {
  entry: string | string[] | Record<string, string>
  name?: string
  formats?: LibraryFormat[]
  fileName?: string | ((format: LibraryFormat, entryName: string) => string)
  cssFileName?: string
  externals?: (string | RegExp)[]
  globals?: Record<string, string>
}

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
  registerCleanup?: (cleanup: () => Promise<void> | void) => void
}

export interface BundlerBuildOptions {
  onBuildStatus?: (status: BuildStatus) => void
}

export interface NormalizedConfig {
  bundler: 'rspack' | 'vite'
  quiet: boolean
  pages: Pages
  enablePages?: string[] | false
  define: Record<string, unknown>
  resolve: {
    alias: Record<string, string>
    extensions: string[]
  }
  server: {
    port: number
    proxy?: Record<string, string | ProxyOptions>
    https: boolean | HttpsServerOptions
  }
  build: {
    base: string
    assetsDir: string
    gzip: boolean
    sourceMap: boolean
    outDirName: string
    outReport: boolean
    cache: boolean
    dependencyCycleCheck: boolean
  }
  vite?: {
    plugins?: PluginOption | PluginOption[]
  }
  library: LibraryConfig | null
  base: string
  port: number
  isElectron: boolean
}

// ─── CreateConfigParams（与主包 CreateConfigParams 对齐）─────────────────

export interface CreateConfigParams {
  command: Command
  mode?: string
  env: Record<string, unknown>
  context: string
  contextPkg?: { name: string; version: string }
  config: NormalizedConfig
  resolveContext: (...paths: string[]) => string
}

// ─── 兼容导出（保留给内部工具使用）────────────────────────────────────────

export type ViteUserConfigSubset = NormalizedConfig
