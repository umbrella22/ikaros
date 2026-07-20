import type { BuildPlan } from '../build-plan'
import type { Command, CompileContext } from '../compile/compile-context'
import type { PluginManager } from '../core/plugin-manager'
import type { CleanupFn } from '../watchdog/cleanup-registry'
import type { logger } from '../shared/logger'

export type AdapterLogger = typeof logger

export interface BuildStatus {
  success: boolean
  message?: string
  port?: number
  /** 预留多目标结构 */
  target?: 'web' | 'renderer' | 'main' | 'preload'
}

export interface BundlerDevOptions {
  port?: number
  onBuildStatus?: (status: BuildStatus) => void
  registerCleanup?: (cleanup: CleanupFn) => void
}

export interface BundlerBuildOptions {
  onBuildStatus?: (status: BuildStatus) => void
  registerCleanup?: (cleanup: CleanupFn) => void
}

export type PlanDevOptions = BundlerDevOptions
export type PlanBuildOptions = BundlerBuildOptions

export interface BundlerAdapter<TConfig = any> {
  readonly name: 'rspack' | 'vite'
  supports(plan: BuildPlan): boolean
  createConfig(plan: BuildPlan): TConfig | Promise<TConfig>
  runDev(config: TConfig, options: BundlerDevOptions): Promise<void>
  runBuild(
    config: TConfig,
    options: BundlerBuildOptions,
  ): Promise<string | undefined>
  watchBuild?: (config: TConfig, options: BundlerBuildOptions) => Promise<void>
}

export interface BuildPlanExecutor {
  createConfig(plan: BuildPlan): Promise<unknown>
  runDev(plan: BuildPlan, options?: PlanDevOptions): Promise<void>
  runDevConfig(
    bundler: BuildPlan['bundler'],
    config: unknown,
    options?: PlanDevOptions,
  ): Promise<void>
  runBuild(
    plan: BuildPlan,
    options?: PlanBuildOptions,
  ): Promise<string | undefined>
  watchBuild(plan: BuildPlan, options?: PlanBuildOptions): Promise<void>
  runBuildConfig(
    bundler: BuildPlan['bundler'],
    config: unknown,
    options?: PlanBuildOptions,
  ): Promise<string | undefined>
  watchBuildConfig(
    bundler: BuildPlan['bundler'],
    config: unknown,
    options?: PlanBuildOptions,
  ): Promise<void>
}

export interface PlatformPlanContext {
  command: Command
  compileContext: CompileContext
  config: import('../config/normalize-config').NormalizedConfig
}

export interface PlatformRunContext {
  command: 'server' | 'build'
  plans: BuildPlan[]
  compileContext: CompileContext
  pluginManager: PluginManager
  executor: BuildPlanExecutor
  logger: AdapterLogger
}

export interface PlatformAdapter {
  readonly name: 'web' | 'desktopClient'
  createPlans(ctx: PlatformPlanContext): Promise<BuildPlan[]>
  run(ctx: PlatformRunContext): Promise<void>
}

export type {
  AdapterCapability,
  AdapterCapabilityStatus,
  BuildPlan,
  BuildPlanDev,
  BuildPlanDiagnostic,
  BuildPlanEntry,
  BuildPlanOutput,
  BuildPlanSource,
  BuildPlanTrace,
  BuildTargetKind,
  RspackAdapterOptions,
  ViteAdapterOptions,
} from '../build-plan'
export type { CleanupFn, CompileContext }
