import type { ServerOptions as HttpsServerOptions } from 'node:https'
import type { InlineConfig, PluginOption, ProxyOptions } from 'vite'

import { createIkarosViteBuildPlugin } from '../plugins/vite-build-plugin'
import type { CreateWebViteConfigParams } from '../types'

const normalizeDefine = (define: Record<string, unknown> | undefined) => {
  if (!define) return undefined

  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(define)) {
    if (typeof value === 'string') {
      out[key] = JSON.stringify(value)
    } else {
      out[key] = value
    }
  }
  return out
}

const getOutDirPath = (params: {
  userConfig?: CreateWebViteConfigParams['userConfig']
  isElectron: boolean
  resolveContext: (...paths: string[]) => string
}): string => {
  const { userConfig, isElectron, resolveContext } = params

  const outDirName = userConfig?.build?.outDirName

  if (isElectron) {
    const defaultOutput = resolveContext('dist/electron/renderer')
    return defaultOutput
  }

  if (typeof outDirName === 'string' && outDirName) {
    return resolveContext(outDirName)
  }

  return resolveContext('dist')
}

const resolveRollupInput = (params: {
  pages: CreateWebViteConfigParams['pages']
  enablePages: CreateWebViteConfigParams['userConfig'] extends {
    enablePages?: infer P
  }
    ? P
    : unknown
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

const sanitizeViteExtensions = (
  input: string[] | undefined,
): string[] | undefined => {
  if (!input?.length) return

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

const toViteProxy = (
  proxy: unknown,
): Record<string, string | ProxyOptions> | undefined => {
  if (proxy && typeof proxy === 'object' && !Array.isArray(proxy)) {
    return proxy as Record<string, string | ProxyOptions>
  }
}

const toViteHttps = (https: unknown): HttpsServerOptions | undefined => {
  if (typeof https === 'boolean') return https ? {} : undefined
  if (https && typeof https === 'object') {
    return https as HttpsServerOptions
  }
}

const toPluginsArray = (
  plugins: PluginOption | PluginOption[] | undefined,
): PluginOption[] => {
  if (!plugins) return []
  return Array.isArray(plugins) ? plugins : [plugins]
}

export const createWebViteConfig = (
  params: CreateWebViteConfigParams,
): InlineConfig => {
  const {
    command,
    mode,
    env: envVars,
    context,
    userConfig,
    pages,
    base,
    port,
    isElectron,
    resolveContext,
  } = params

  const isDev = command === 'server'

  const userVitePlugins = userConfig?.vite?.plugins

  const plugins = toPluginsArray(userVitePlugins)

  const ikarosBuildPlugin =
    command === 'build'
      ? createIkarosViteBuildPlugin({
          gzip: userConfig?.build?.gzip,
          outReport: userConfig?.build?.outReport,
          dependencyCycleCheck: userConfig?.build?.dependencyCycleCheck,
        })
      : undefined

  const rollupInput = resolveRollupInput({
    pages,
    enablePages: userConfig?.enablePages,
  })

  const alias = {
    '@': resolveContext('src'),
    ...(userConfig?.resolve?.alias ?? {}),
  }

  return {
    root: context,
    base,
    mode,
    appType: rollupInput ? 'mpa' : 'spa',
    plugins: [...plugins, ...(ikarosBuildPlugin ? [ikarosBuildPlugin] : [])],
    define: {
      ...normalizeDefine(envVars),
      ...normalizeDefine(userConfig?.define),
    },
    resolve: {
      alias,
      extensions: sanitizeViteExtensions(userConfig?.resolve?.extensions),
    },
    server: isDev
      ? {
          port,
          strictPort: true,
          proxy: toViteProxy(userConfig?.server?.proxy),
          https: toViteHttps(userConfig?.server?.https),
        }
      : undefined,
    build: {
      outDir: getOutDirPath({ userConfig, isElectron, resolveContext }),
      sourcemap: userConfig?.build?.sourceMap ?? false,
      assetsDir: userConfig?.build?.assetsDir,
      rollupOptions: rollupInput
        ? {
            input: rollupInput,
          }
        : undefined,
    },
  }
}
