// platform/types.ts — PlatformAdapter 接口定义

export type {
  AdapterLogger,
  BuildPlanExecutor,
  PlatformAdapter,
  PlatformPlanContext,
  PlatformRunContext,
} from '../adapter'
import type { NormalizedConfig } from '../config/normalize-config'

// ─── PlatformPreConfig ──────────────────────────────────────────────────────

export type PlatformPreConfig = NormalizedConfig

// ─── PlatformAdapter ────────────────────────────────────────────────────────

/**
 * 平台适配器接口
 *
 * 抽象出 Web / Desktop 两种平台的编译职责：
 * - resolvePreConfig: 解析平台相关的规范化配置（port、browserslist、pages 等）
 * - compile: 执行编译（Web 直接调用 bundler；Desktop 需要编排 main/preload/renderer）
 */
