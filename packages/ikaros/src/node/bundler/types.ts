import type { PreWarning } from '../plugins/pre-warnings-plugin'

export type {
  BuildStatus,
  BundlerAdapter,
  BundlerBuildOptions,
  BundlerDevOptions,
} from '../adapter'

// ─── CreateConfigParams ─────────────────────────────────────────────────────

export interface CreateConfigParams {
  command: 'server' | 'build'
  mode?: string
  env: Record<string, unknown>
  context: string
  contextPkg?: { name: string; version: string }
  config: import('../config/normalize-config').NormalizedConfig
  resolveContext: (...paths: string[]) => string
  preWarnings?: PreWarning[]
}
