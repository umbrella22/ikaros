import type { NormalizedConfig } from '../config/normalize-config'
import type { PreWarning } from '../plugins/pre-warnings-plugin'
import type { CleanupFn } from '../watchdog/cleanup-registry'

// ─── BuildStatus ────────────────────────────────────────────────────────────

export interface BuildStatus {
  success: boolean
  message?: string
  port?: number
  /** 预留多目标结构 */
  target?: 'web' | 'renderer' | 'main' | 'preload'
}

// ─── BundlerAdapter ─────────────────────────────────────────────────────────

/**
 * 编译器适配器接口
 *
 * 泛型参数 TConfig 默认为 unknown，core 层按 BundlerAdapter（即 BundlerAdapter<unknown>）对待；
 * adapter 实现内部可指定具体类型以获得强类型约束。
 * 例如：class RspackAdapter implements BundlerAdapter<Configuration> { ... }
 */
export interface BundlerAdapter<TConfig = unknown> {
  /** 编译器标识 */
  readonly name: 'rspack' | 'vite'

  /**
   * 根据编译参数生成编译器配置
   */
  createConfig(params: CreateConfigParams): TConfig | Promise<TConfig>

  /**
   * 启动开发服务器
   */
  runDev(config: TConfig, options: BundlerDevOptions): Promise<void>

  /**
   * 执行生产构建
   */
  runBuild(
    config: TConfig,
    options: BundlerBuildOptions,
  ): Promise<string | undefined>
}

// ─── CreateConfigParams ─────────────────────────────────────────────────────

export interface CreateConfigParams {
  command: 'server' | 'build'
  mode?: string
  env: Record<string, unknown>
  context: string
  contextPkg?: { name: string; version: string }
  config: NormalizedConfig
  resolveContext: (...paths: string[]) => string
  preWarnings?: PreWarning[]
}

// ─── Dev / Build Options ────────────────────────────────────────────────────

export interface BundlerDevOptions {
  port?: number
  onBuildStatus?: (status: BuildStatus) => void
  registerCleanup?: (cleanup: CleanupFn) => void
}

export interface BundlerBuildOptions {
  onBuildStatus?: (status: BuildStatus) => void
}
