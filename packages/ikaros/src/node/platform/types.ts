// platform/types.ts — PlatformAdapter 接口定义

import type { UserConfig } from '../config/user-config'
import type { Pages } from '../bundler/rspack/loader-plugin-helper'
import type { BundlerAdapter } from '../bundler/types'
import type { CompileContext } from '../compile/compile-context'

// ─── PlatformPreConfig ──────────────────────────────────────────────────────

/**
 * 平台预配置
 *
 * 由 PlatformAdapter.resolvePreConfig() 返回，包含平台相关的配置解析结果。
 * 与 WebPreConfig 形状一致，作为 platform 层的规范类型。
 */
export interface PlatformPreConfig {
  userConfig?: UserConfig
  base: string
  target: 'pc' | 'mobile'
  pages: Pages
  port: number
  browserslist: string
  isVue: boolean
  isReact: boolean
}

// ─── PlatformAdapter ────────────────────────────────────────────────────────

/**
 * 平台适配器接口
 *
 * 抽象出 Web / Desktop 两种平台的编译职责：
 * - resolvePreConfig: 解析平台相关的预配置（port、browserslist、pages 等）
 * - compile: 执行编译（Web 直接调用 bundler；Desktop 需要编排 main/preload/renderer）
 */
export interface PlatformAdapter {
  /** 平台标识 */
  readonly name: 'web' | 'desktopClient'

  /**
   * 解析平台相关的预配置
   *
   * - Web 平台：确定 port、browserslist、pages、检测 Vue/React 等
   * - Desktop 平台：同上（用于 renderer），内部另行处理 main/preload
   */
  resolvePreConfig(ctx: CompileContext): Promise<PlatformPreConfig>

  /**
   * 执行编译
   *
   * - Web 平台：直接调用 bundler.createConfig + runDev/runBuild
   * - Desktop 平台：包装 main/preload/renderer 三目标编排
   *
   * @param bundler  编译器适配器（由 pipeline 根据 userConfig.bundler 创建）
   * @param params   编译参数
   */
  compile(bundler: BundlerAdapter, params: PlatformCompileParams): Promise<void>
}

// ─── PlatformCompileParams ──────────────────────────────────────────────────

export interface PlatformCompileParams {
  /** 当前命令 */
  command: 'server' | 'build'
  /** 平台预配置（由 resolvePreConfig 返回） */
  preConfig: PlatformPreConfig
  /** 编译上下文 */
  compileContext: CompileContext
}
