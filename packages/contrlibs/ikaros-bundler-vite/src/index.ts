// ─── 类型导出 ─────────────────────────────────────────────────────────────
export type {
  BuildStatus,
  BundlerAdapter,
  BundlerBuildOptions,
  BundlerDevOptions,
  Command,
  CreateConfigParams,
  Pages,
  ViteUserConfigSubset,
} from './types'

export type { DetectCyclesContext } from './plugins/vite-build-plugin'

// ─── Core API ──────────────────────────────────────────────────────────────
export { createViteConfig } from './config/create-vite-config'
export { ViteBundlerAdapter } from './vite-adapter'
export { BundlerError } from './errors'
export { detectCycles } from './plugins/vite-build-plugin'

// ─── Runner ─────────────────────────────────────────────────────────────────
export { runViteBuild, startViteDevServer } from './runner/vite-runner'
