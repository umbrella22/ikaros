// config/ 目录统一导出

export type {
  Bundler,
  ElectronConfig,
  IkarosPlugin,
  LibraryConfig,
  LibraryFormat,
  ModuleFederationOptions,
  ResolvedUserConfig,
  RspackConfig,
  UserConfig,
  ConfigEnvPre,
  UserConfigFn,
  ViteConfig,
  UserConfigWebExport,
} from './user-config'
export { defineConfig } from './user-config'

export { configSchema } from './config-schema'
export { mergeConfig } from './merge-config'
export {
  normalizeConfig,
  type NormalizeConfigParams,
  type NormalizedBuildConfig,
  type NormalizedConfig,
  type NormalizedResolveConfig,
  type NormalizedRspackConfig,
  type NormalizedServerConfig,
  type NormalizedViteConfig,
} from './normalize-config'

export { resolveConfig } from './config-loader'

export { getEnv, type EnvResult } from './env-loader'
