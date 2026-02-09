// platform/ 统一导出

// ─── 接口与类型 ─────────────────────────────────────────────────────────────
export type {
  PlatformAdapter,
  PlatformPreConfig,
  PlatformCompileParams,
} from './types'

// ─── 工厂 ───────────────────────────────────────────────────────────────────
export { createPlatformAdapter } from './platform-factory'

// ─── Web 平台实现 ───────────────────────────────────────────────────────────
export { WebPlatformAdapter } from './web'

// ─── resolve-web-preconfig（供外部包使用） ───────────────────────────────────
export {
  resolveWebPreConfig,
  type WebPreConfig,
  type ResolveWebPreConfigParams,
} from './web'
