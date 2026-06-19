import { relative } from 'node:path'
import type { ServerOptions as HttpsServerOptions } from 'node:https'
import type { PluginOption, ProxyOptions } from 'vite'

import type { NormalizedConfig } from '../types'

const VITE_DEFAULT_EXTENSIONS = [
  '.mjs',
  '.js',
  '.mts',
  '.ts',
  '.jsx',
  '.tsx',
  '.json',
] as const

const normalizePath = (value: string): string => value.replace(/\\/g, '/')

const isRootIndexHtml = (html: string, context: string): boolean => {
  const normalized = normalizePath(html)
  if (normalized === 'index.html' || normalized === './index.html') {
    return true
  }

  if (normalized === '/index.html') {
    return true
  }

  return normalizePath(relative(context, html)) === 'index.html'
}

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

export const normalizeEnvDefine = (
  env: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined => {
  const normalized = normalizeDefine(env)
  if (!normalized) return undefined

  return Object.fromEntries(
    Object.entries(normalized).map(([key, value]) => [
      `import.meta.env.${key}`,
      value,
    ]),
  )
}

/**
 * 过滤并规范化 Vite resolve.extensions
 *
 * - 排除空字符串
 * - 将 rspack 的 '...' spread 语法展开为 Vite 默认扩展名
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
    if (ext === '...') {
      for (const defaultExt of VITE_DEFAULT_EXTENSIONS) {
        if (!out.includes(defaultExt)) out.push(defaultExt)
      }
      continue
    }
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
  context: string
}): Record<string, string> | undefined => {
  const { pages, enablePages, context } = params

  const entries = Object.entries(pages)
  const enabled = Array.isArray(enablePages) ? new Set(enablePages) : undefined

  const filtered = enabled
    ? entries.filter(([name]) => enabled.has(name))
    : entries

  if (filtered.length === 0) {
    return undefined
  }

  if (filtered.length === 1) {
    const [[, page]] = filtered
    if (isRootIndexHtml(page.html, context)) {
      return undefined
    }
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

  if (Array.isArray(proxy)) {
    const out: Record<string, string | ProxyOptions> = {}

    for (const item of proxy) {
      if (!item || typeof item !== 'object' || typeof item === 'function') {
        continue
      }

      const { context, pathFilter, ...options } = item as Record<string, unknown>
      const rawContexts = pathFilter ?? context
      const contexts = Array.isArray(rawContexts) ? rawContexts : [rawContexts]

      for (const key of contexts) {
        if (typeof key !== 'string') continue
        out[key] = options as ProxyOptions
      }
    }

    return Object.keys(out).length > 0 ? out : undefined
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
