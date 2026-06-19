export {
  defineConfig,
  migrateLegacyConfig,
  type ConfigEnvPre,
  type UserConfig,
  type UserConfigFn,
  type UserConfigWebExport,
  type LegacyUserConfig,
  type MigrateLegacyConfigResult,
} from '../config/user-config'
export {
  migrateConfigFile,
  migrateConfigSource,
  type MigrateConfigDiagnostic,
  type MigrateConfigFileParams,
  type MigrateConfigFileResult,
  type MigrateConfigResult,
} from '../config/migrate-config'
