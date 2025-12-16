import type { Configuration, DefinePluginOptions } from '@rspack/core'
import { basename, extname, join } from 'node:path'

import {
  Command,
  CreateLoader,
  CreatePlugins,
  extensions,
  type PackageJson,
  resolveCLI,
  type UserConfig,
} from '@ikaros-cli/ikaros'

export type ElectronPreloadEntryConfigs = Array<{
  name: string
  config: Configuration
}>

export type CreateElectronPreloadRspackConfigsParams = {
  command: Command
  mode?: string
  env: DefinePluginOptions
  context: string
  contextPkg?: PackageJson
  userConfig?: UserConfig
  resolveContext: (...paths: string[]) => string
}

const isRecord = (val: unknown): val is Record<string, unknown> => {
  return !!val && typeof val === 'object' && !Array.isArray(val)
}

const resolvePreloadEntries = (
  userConfig: UserConfig | undefined,
): Record<string, string> => {
  const electronConfig = userConfig?.electron
  // 约定：预加载脚本编译后的名字是 preload-[文件名].js
  const defaultEntry = { 'preload-index': 'src/preload/index.ts' }

  const entriesRaw = electronConfig?.preload?.entries
  if (!entriesRaw) {
    return defaultEntry
  }

  if (Array.isArray(entriesRaw)) {
    const entries: Record<string, string> = {}
    entriesRaw.forEach((entry) => {
      const fileBase = basename(entry, extname(entry))
      const name = `preload-${fileBase}`

      if (entries[name]) {
        throw new Error(`preload.entries 存在重复文件名导致输出冲突: ${name}`)
      }

      entries[name] = entry
    })
    return entries
  }

  if (isRecord(entriesRaw)) {
    return entriesRaw as Record<string, string>
  }

  return defaultEntry
}

const resolvePreloadOutputDir = (
  userConfig: UserConfig | undefined,
  resolveContext: (...paths: string[]) => string,
): string => {
  const electronConfig = userConfig?.electron
  const defaultOutput = resolveContext('dist/electron/main')

  if (electronConfig?.build?.outDir) {
    return join(resolveContext(electronConfig.build.outDir), 'main')
  }

  if (electronConfig?.preload?.output) {
    return resolveContext(electronConfig.preload.output)
  }

  return defaultOutput
}

export const createElectronPreloadRspackConfigs = async (
  params: CreateElectronPreloadRspackConfigsParams,
): Promise<ElectronPreloadEntryConfigs> => {
  const {
    command,
    mode,
    env: defineEnv,
    context,
    userConfig,
    resolveContext,
  } = params

  const isDev = command === Command.SERVER
  const env = isDev ? 'development' : 'production'

  const electronConfig = userConfig?.electron

  const entries = resolvePreloadEntries(userConfig)
  const outputDir = resolvePreloadOutputDir(userConfig, resolveContext)

  const result: ElectronPreloadEntryConfigs = []

  for (const [name, entryPath] of Object.entries(entries)) {
    const loaderHelper = new CreateLoader({
      env,
      mode,
    })
    const pluginHelper = new CreatePlugins({
      env,
      mode,
    })

    const preloadLoaders =
      electronConfig?.preload?.loaders || userConfig?.loaders
    const preloadPlugins =
      electronConfig?.preload?.plugins || userConfig?.plugins

    const rules = loaderHelper
      .useDefaultScriptLoader()
      .add(preloadLoaders)
      .end()

    const plugins = pluginHelper
      .useDefaultEnvPlugin({
        env: defineEnv,
        extEnv: userConfig?.define,
      })
      .add(preloadPlugins)
      .end()

    const config: Configuration = {
      mode: env,
      target: 'electron-preload',
      context,
      entry: {
        [name]: resolveContext(entryPath),
      },
      resolve: {
        alias: {
          '@': resolveContext('src'),
          ...userConfig?.resolve?.alias,
        },
        extensions: userConfig?.resolve?.extensions || extensions,
        modules: [
          'node_modules',
          resolveContext('node_modules'),
          resolveCLI('node_modules'),
        ],
      },
      output: {
        clean: false,
        path: outputDir,
        filename: `${name}.js`,
        pathinfo: false,
      },
      stats: 'none',
      watchOptions: {
        aggregateTimeout: 500,
        ignored: /node_modules/,
      },
      module: {
        rules,
      },
      plugins,
      externals: {
        electron: 'commonjs electron',
      },
    }

    result.push({ name, config })
  }

  return result
}
