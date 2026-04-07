export * from './config/user-config'
export {
  normalizeConfig,
  mergeConfig,
  type NormalizeConfigParams,
  type NormalizedBuildConfig,
  type NormalizedConfig,
  type NormalizedResolveConfig,
  type NormalizedRspackConfig,
  type NormalizedServerConfig,
  type NormalizedViteConfig,
} from './config'

// ─── Ikaros Instance ───────────────────────────────────────────────────────
export { createIkaros } from './core/create-ikaros'
export {
  DefaultIkarosInstance,
  type CreateIkarosOptions,
  type IkarosInstance,
} from './core/ikaros-instance'
export {
  createPluginManager,
  PluginManager,
  type PluginManagerDiagnostics,
} from './core/plugin-manager'
export {
  createIkarosPluginAPI,
  type IkarosAfterBuildContext,
  type IkarosLifecycleContext,
  type IkarosPluginAPI,
  type IkarosPluginHooks,
  type ModifyBundlerConfigContext,
  type ModifyBundlerConfigHandler,
  type ModifyIkarosConfigContext,
  type ModifyIkarosConfigHandler,
  type ModifyNormalizedConfigContext,
  type ModifyNormalizedConfigHandler,
} from './core/plugin-api'

// ─── CompileContext ─────────────────────────────────────────────────────────
export {
  createCompileContext,
  Command,
  type CompileContext,
  type CompileOptions,
  type CompileServeParams,
  type PackageJson,
} from './compile/compile-context'

// ─── PlatformAdapter ────────────────────────────────────────────────────────
export {
  createPlatformAdapter,
  WebPlatformAdapter,
  type PlatformAdapter,
  type PlatformPreConfig,
  type PlatformCompileParams,
} from './platform'
export {
  resolveWebPreConfig,
  type WebPreConfig,
  type ResolveWebPreConfigParams,
} from './compile/web/resolve-web-preconfig'

export { LoggerSystem } from './shared/logger'
export {
  inspectConfig,
  serializeConfig,
  type InspectEnvDiagnostics,
  type InspectConfigParams,
  type InspectConfigResult,
  type InspectHookDiagnostics,
  type InspectWatchDiagnostics,
  type SerializedInspectValue,
} from './inspect'

// ─── Watchdog（看门狗） ─────────────────────────────────────────────────────
export {
  classifyWatchdogRestartReason,
  createWatchdog,
  createCleanupRegistry,
  resolveWatchdogWatchPlan,
  type CleanupFn,
  type CleanupRegistry,
  type WatchdogOptions,
  type WatchdogInstance,
  type WatchdogRestartReason,
  type WatchdogTrackedFileKind,
  type WatchdogWatchPlan,
} from './watchdog'
export {
  runRspackBuild,
  watchRspackBuild,
} from './bundler/rspack/rspack-runner'
export { assertNodeVersion } from './shared/check-env'
export { extensions, resolveCLI } from './shared/constants'
export {
  CreateLoader,
  CreatePlugins,
} from './bundler/rspack/loader-plugin-helper'

// ─── Bundler Adapter (P0 新增) ──────────────────────────────────────────────
export { createBundlerAdapter } from './bundler/bundler-factory'
export type { CreateBundlerAdapterParams } from './bundler/bundler-factory'
export { RspackAdapter } from './bundler/rspack'
export { ViteAdapterLoader } from './bundler/vite'
export type {
  BundlerAdapter,
  CreateConfigParams,
  BundlerDevOptions,
  BundlerBuildOptions,
  BuildStatus,
} from './bundler/types'
