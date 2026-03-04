// config/create-vite-library-config.ts — Vite 库模式配置生成

import type { InlineConfig, LibraryFormats } from 'vite'

import type { CreateConfigParams, LibraryConfig, LibraryFormat } from '../types'
import {
  normalizeDefine,
  sanitizeViteExtensions,
  getOutDirPath,
  toPluginsArray,
} from './normalize'

// ─── Format Mapping ─────────────────────────────────────────────────────────

/**
 * 将统一的 LibraryFormat 映射为 Vite LibraryFormats
 */
const mapFormatToViteFormat = (format: LibraryFormat): LibraryFormats => {
  switch (format) {
    case 'es':
      return 'es'
    case 'cjs':
      return 'cjs'
    case 'umd':
      return 'umd'
    case 'iife':
      return 'iife'
  }
}

// ─── Entry Resolution ───────────────────────────────────────────────────────

const resolveEntry = (
  entry: LibraryConfig['entry'],
  resolveContext: (...paths: string[]) => string,
): string | string[] | Record<string, string> => {
  if (typeof entry === 'string') {
    return resolveContext(entry)
  }

  if (Array.isArray(entry)) {
    return entry.map((e) => resolveContext(e))
  }

  return Object.fromEntries(
    Object.entries(entry).map(([name, path]) => [name, resolveContext(path)]),
  )
}

const isMultiEntry = (entry: LibraryConfig['entry']): boolean => {
  if (typeof entry === 'string') return false
  if (Array.isArray(entry)) return entry.length > 1
  return Object.keys(entry).length > 1
}

// ─── Externals Resolution ───────────────────────────────────────────────────

/**
 * 将统一的 externals 转换为 Vite/Rolldown external 格式
 */
const resolveViteExternals = (
  externals: LibraryConfig['externals'],
): (string | RegExp)[] | undefined => {
  if (!externals?.length) return undefined
  return externals
}

/**
 * 将统一的 globals 转换为 Vite/Rolldown output.globals 格式
 */
const resolveViteGlobals = (
  globals: LibraryConfig['globals'],
): Record<string, string> | undefined => {
  if (!globals || Object.keys(globals).length === 0) return undefined
  return globals
}

// ─── File Name Resolution ───────────────────────────────────────────────────

/**
 * 将统一的 fileName 转换为 Vite 兼容格式
 */
const resolveViteFileName = (
  fileName: LibraryConfig['fileName'],
): string | ((format: string, entryName: string) => string) | undefined => {
  if (!fileName) return undefined

  if (typeof fileName === 'string') {
    return fileName
  }

  // 包装函数以匹配 Vite 签名
  return (format: string, entryName: string) =>
    fileName(format as LibraryFormat, entryName)
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * 创建 Vite 库模式编译配置
 *
 * 将统一的 LibraryConfig 适配为 Vite build.lib + rolldownOptions
 */
export const createViteLibraryConfig = (
  params: CreateConfigParams,
): InlineConfig => {
  const {
    mode,
    env: envVars,
    context,
    userConfig,
    isElectron,
    resolveContext,
  } = params

  const library = userConfig?.library
  if (!library) {
    throw new Error('[ikaros] library config is required for library mode')
  }

  const userVitePlugins = userConfig?.vite?.plugins
  const plugins = toPluginsArray(userVitePlugins)

  const multi = isMultiEntry(library.entry)
  const formats = (
    library.formats ?? (multi ? ['es', 'cjs'] : ['es', 'umd'])
  ).map(mapFormatToViteFormat)

  const alias = {
    '@': resolveContext('src'),
    ...(userConfig?.resolve?.alias ?? {}),
  }

  const external = resolveViteExternals(library.externals)
  const globals = resolveViteGlobals(library.globals)

  return {
    root: context,
    base: userConfig?.build?.base ?? '/',
    mode,
    plugins,
    define: {
      ...normalizeDefine(envVars),
      ...normalizeDefine(userConfig?.define),
    },
    resolve: {
      alias,
      extensions: sanitizeViteExtensions(userConfig?.resolve?.extensions),
    },
    build: {
      outDir: getOutDirPath({ userConfig, isElectron, resolveContext }),
      sourcemap: userConfig?.build?.sourceMap ?? false,
      lib: {
        entry: resolveEntry(library.entry, resolveContext),
        name: library.name,
        formats,
        fileName: resolveViteFileName(library.fileName),
        cssFileName: library.cssFileName,
      },
      rollupOptions: {
        ...(external ? { external } : {}),
        ...(globals
          ? {
              output: {
                globals,
              },
            }
          : {}),
      },
    },
  }
}
