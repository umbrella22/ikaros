import type { ServerOptions as HttpsServerOptions } from 'node:https'
import type { PluginOption, ProxyOptions } from 'vite'

import type { NormalizedConfig } from '../types'

/**
 * 将 define 值统一序列化为 Vite 可接受的格式
 *
 * Vite 的 define 要求字符串值作为原始表达式使用：
 * - 字符串常量需要 JSON.stringify 包裹（产生 '"hello"'）
 * - boolean / number 等原始值可直接传递（Vite 原生支持）
 * - 对象/数组类型必须 JSON.stringify，避免产生 [object Object]
 */
export const normalizeDefine = (
  define: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined => {
  if (!define) return undefined

  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(define)) {
    if (typeof value === 'string') {
      // 字符串常量需要额外 JSON.stringify 以产生带引号的表达式
      out[key] = JSON.stringify(value)
    } else if (value !== null && typeof value === 'object') {
      // 对象/数组必须序列化，否则 Vite 会产生 [object Object]
      out[key] = JSON.stringify(value)
    } else {
      // boolean / number / null / undefined — Vite 原生支持
      out[key] = value
    }
  }
  return out
}

/**
 * 过滤并规范化 Vite resolve.extensions
 *
 * - 排除空字符串
 * - 排除 rspack 的 '...' spread 语法（Vite 不支持）
 * - 确保以 '.' 开头
 * - 去重
 */
export const sanitizeViteExtensions = (
  input: string[] | undefined,
): string[] | undefined => {
  if (!input?.length) return undefined

  const out: string[] = []
  for (const ext of input) {
    if (typeof ext !== 'string') continue
    if (!ext) continue
    if (ext === '...') continue
    if (!ext.startsWith('.')) continue
    if (!out.includes(ext)) out.push(ext)
  }

  return out.length ? out : undefined
}

/**
 * 解析输出目录路径
 */
export const getOutDirPath = (params: {
  config: NormalizedConfig
  resolveContext: (...paths: string[]) => string
}): string => {
  const { config, resolveContext } = params
  const outDirName = config.build.outDirName

  if (config.isElectron) {
    return resolveContext('dist/electron/renderer')
  }

  if (typeof outDirName === 'string' && outDirName) {
    return resolveContext(outDirName)
  }

  return resolveContext('dist')
}

/**
 * 解析多页应用的 Rollup input 配置
 */
export const resolveRollupInput = (params: {
  pages: NormalizedConfig['pages']
  enablePages: NormalizedConfig['enablePages']
}): Record<string, string> | undefined => {
  const { pages, enablePages } = params

  const entries = Object.entries(pages)
  const enabled = Array.isArray(enablePages) ? new Set(enablePages) : undefined

  const filtered = enabled
    ? entries.filter(([name]) => enabled.has(name))
    : entries

  if (filtered.length <= 1) {
    return undefined
  }

  return Object.fromEntries(filtered.map(([name, page]) => [name, page.html]))
}

/**
 * 转换用户代理配置为 Vite 格式
 */
export const toViteProxy = (
  proxy: unknown,
): Record<string, string | ProxyOptions> | undefined => {
  if (proxy && typeof proxy === 'object' && !Array.isArray(proxy)) {
    return proxy as Record<string, string | ProxyOptions>
  }
  return undefined
}

/**
 * 转换 HTTPS 配置为 Vite 格式
 */
export const toViteHttps = (https: unknown): HttpsServerOptions | undefined => {
  if (typeof https === 'boolean') return https ? {} : undefined
  if (https && typeof https === 'object') {
    return https as HttpsServerOptions
  }
  return undefined
}

/**
 * 确保 Vite 插件为数组形式
 */
export const toPluginsArray = (
  plugins: PluginOption | PluginOption[] | undefined,
): PluginOption[] => {
  if (!plugins) return []
  return Array.isArray(plugins) ? plugins : [plugins]
}
