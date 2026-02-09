import type { InlineConfig } from 'vite'

import { createIkarosViteBuildPlugin } from '../plugins/vite-build-plugin'
import type { CreateConfigParams } from '../types'
import {
  getOutDirPath,
  normalizeDefine,
  resolveRollupInput,
  sanitizeViteExtensions,
  toPluginsArray,
  toViteHttps,
  toViteProxy,
} from './normalize'

/**
 * 创建 Vite 编译配置
 *
 * 接受完整的 CreateConfigParams（与主包 BundlerAdapter.createConfig 参数对齐）。
 */
export const createViteConfig = (params: CreateConfigParams): InlineConfig => {
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
