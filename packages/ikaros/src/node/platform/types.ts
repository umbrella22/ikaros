// platform/types.ts — PlatformAdapter 接口定义

import type { BundlerAdapter } from '../bundler/types'
import type { CompileContext } from '../compile/compile-context'
import type { NormalizedConfig } from '../config/normalize-config'
import type { PluginManager } from '../core/plugin-manager'

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
export interface PlatformAdapter {
  /** 平台标识 */
  readonly name: 'web' | 'desktopClient'

  /**
   * 解析平台相关的预配置
   *
   * - Web 平台：生成规范化配置
   * - Desktop 平台：可在规范化后附加平台特定编排信息
   */
  resolvePreConfig(ctx: CompileContext): Promise<PlatformPreConfig>

  /**
   * 执行编译
   *
   * - Web 平台：直接调用 bundler.createConfig + runDev/runBuild
   * - Desktop 平台：包装 main/preload/renderer 三目标编排
   *
   * @param bundler  编译器适配器（由 pipeline 根据 normalized config 的 bundler 创建）
   * @param params   编译参数
   */
  compile(bundler: BundlerAdapter, params: PlatformCompileParams): Promise<void>
}

// ─── PlatformCompileParams ──────────────────────────────────────────────────

export interface PlatformCompileParams {
  /** 当前命令 */
  command: 'server' | 'build'
  /** 平台规范化配置（由 resolvePreConfig 返回） */
  preConfig: PlatformPreConfig
  /** 编译上下文 */
  compileContext: CompileContext
  /** 当前编译轮次的插件管理器 */
  pluginManager: PluginManager
}
