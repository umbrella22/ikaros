import type { InlineConfig } from 'vite'

import { createIkarosViteBuildPlugin } from '../plugins/vite-build-plugin'
import type { CreateConfigParams } from '../types'
import {
  getOutDirPath,
  normalizeDefine,
  normalizeEnvDefine,
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
    context,
  })

  const alias = config.resolve.alias

  // Electron 渲染进程经 file:// 加载,绝对路径资源无法解析,构建时 base 需置为相对路径。
  // 与 rspack output.publicPath 的 `isElectron && !isDev ? './' : config.base` 保持一致。
  const base = config.isElectron && command === 'build' ? './' : config.base

  return {
    root: context,
    base,
    mode,
    appType: rollupInput ? 'mpa' : 'spa',
    plugins: [...plugins, ...(ikarosBuildPlugin ? [ikarosBuildPlugin] : [])],
    define: {
      ...normalizeEnvDefine(envVars),
      ...normalizeDefine(config.define),
    },
    resolve: {
      alias,
      extensions: sanitizeViteExtensions(config.resolve.extensions),
    },
    server: isDev
      ? {
          host: '0.0.0.0',
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
