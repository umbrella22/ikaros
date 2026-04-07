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
    config,
    resolveContext,
  } = params

  const isDev = command === 'server'

  const userVitePlugins = config.vite?.plugins
  const plugins = toPluginsArray(userVitePlugins)

  const ikarosBuildPlugin =
    command === 'build'
      ? createIkarosViteBuildPlugin({
          gzip: config.build.gzip,
          outReport: config.build.outReport,
          dependencyCycleCheck: config.build.dependencyCycleCheck,
        })
      : undefined

  const rollupInput = resolveRollupInput({
    pages: config.pages,
    enablePages: config.enablePages,
  })

  const alias = config.resolve.alias

  return {
    root: context,
    base: config.base,
    mode,
    appType: rollupInput ? 'mpa' : 'spa',
    plugins: [...plugins, ...(ikarosBuildPlugin ? [ikarosBuildPlugin] : [])],
    define: {
      ...normalizeDefine(envVars),
      ...normalizeDefine(config.define),
    },
    resolve: {
      alias,
      extensions: sanitizeViteExtensions(config.resolve.extensions),
    },
    server: isDev
      ? {
          port: config.port,
          strictPort: true,
          proxy: toViteProxy(config.server.proxy),
          https: toViteHttps(config.server.https),
        }
      : undefined,
    build: {
      outDir: getOutDirPath({ config, resolveContext }),
      sourcemap: config.build.sourceMap,
      assetsDir: config.build.assetsDir || undefined,
      rollupOptions: rollupInput
        ? {
            input: rollupInput,
          }
        : undefined,
    },
  }
}
