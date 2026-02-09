// platform/platform-factory.ts — 平台适配器工厂

import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import type { PlatformAdapter } from './types'
import { WebPlatformAdapter } from './web/web-platform'

/**
 * 动态类型：外部 desktop-client 包导出的 PlatformAdapter
 */
type ExternalPlatformAdapterModule = {
  ElectronDesktopPlatformInstance?: PlatformAdapter
  default?: {
    ElectronDesktopPlatformInstance?: PlatformAdapter
  }
}

/**
 * 根据平台类型创建平台适配器实例
 *
 * 这是 platform 分支逻辑唯一存在的地方。
 * - 'web': 直接实例化内部的 WebPlatformAdapter
 * - 'desktopClient': 懒加载 @ikaros-cli/ikaros-platform-desktop-client 包
 */
export function createPlatformAdapter(platform: string): PlatformAdapter {
  switch (platform) {
    case 'desktopClient':
      return createDesktopPlatformProxy()

    case 'web':
    default:
      return new WebPlatformAdapter()
  }
}

// ─── Desktop 平台懒加载 ────────────────────────────────────────────────────

/**
 * 创建 Desktop 平台代理
 *
 * 使用 Proxy 延迟加载外部包，确保：
 * 1. 首次调用方法时才触发 import
 * 2. 加载失败时给出明确的安装提示
 */
function createDesktopPlatformProxy(): PlatformAdapter {
  let cached: PlatformAdapter | undefined

  const ensureAdapter = async (): Promise<PlatformAdapter> => {
    if (cached) return cached
    cached = await loadDesktopPlatformAdapter()
    return cached
  }

  return {
    name: 'desktopClient',

    async resolvePreConfig(ctx) {
      const adapter = await ensureAdapter()
      return adapter.resolvePreConfig(ctx)
    },

    async compile(bundler, params) {
      const adapter = await ensureAdapter()
      return adapter.compile(bundler, params)
    },
  }
}

/**
 * 从用户项目的 node_modules 加载 desktop-client 包的 PlatformAdapter 实现。
 *
 * 加载失败时区分两类错误：
 * 1. 模块无法解析/加载 → 提示安装可选依赖
 * 2. 模块已加载但导出不符 → 提示已安装但加载失败
 */
async function loadDesktopPlatformAdapter(): Promise<PlatformAdapter> {
  const pkg = '@ikaros-cli/ikaros-platform-desktop-client'

  const createMissingError = (cause?: unknown): Error => {
    const lines = [
      `你启用了 platform='desktopClient'，但未安装可选依赖 ${pkg}。`,
      '',
      '请安装后重试：',
      `  pnpm add -D ${pkg}`,
    ]
    if (cause) {
      const msg = cause instanceof Error ? cause.message : String(cause)
      lines.push('', `原始错误: ${msg}`)
    }
    return new Error(lines.join('\n'))
  }

  let mod: unknown
  try {
    const context = process.cwd()
    const contextRequire = createRequire(join(context, './'))
    const resolved = contextRequire.resolve(pkg)
    mod = await import(pathToFileURL(resolved).href)
  } catch (err) {
    throw createMissingError(err)
  }

  // 兼容 ESM default export / named export
  const exports =
    (mod as ExternalPlatformAdapterModule).default ??
    (mod as ExternalPlatformAdapterModule)
  const adapter = exports.ElectronDesktopPlatformInstance

  if (!adapter || typeof adapter.resolvePreConfig !== 'function') {
    throw new Error(
      [
        `${pkg} 已安装但加载失败：未找到 ElectronDesktopPlatformInstance 导出。`,
        '请确认安装的版本与 @ikaros-cli/ikaros 兼容（需 >=3.0）。',
      ].join('\n'),
    )
  }

  return adapter
}
