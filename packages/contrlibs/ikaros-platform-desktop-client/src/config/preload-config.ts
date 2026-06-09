import type {
  Configuration,
  DefinePluginOptions,
  Loader,
  Plugin,
} from '@rspack/core'
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

export const resolveElectronPreloadEntries = (
  userConfig: UserConfig | undefined,
): Record<string, string> => {
  const electronConfig = userConfig?.electron
  const defaultEntry = { 'main-preload': 'src/preload/index.ts' }

  const entriesRaw = electronConfig?.preload?.entries
  if (!entriesRaw) {
    return defaultEntry
  }

  if (Array.isArray(entriesRaw)) {
    const entries: Record<string, string> = {}
    entriesRaw.forEach((entry) => {
      const fileBase = basename(entry, extname(entry))
      const name = fileBase === 'index' ? 'main-preload' : `${fileBase}`

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
  const defaultOutput = resolveContext('dist/electron/preload')

  if (electronConfig?.build?.outDir) {
    return join(resolveContext(electronConfig.build.outDir), 'preload')
  }

  if (electronConfig?.preload?.output) {
    return resolveContext(electronConfig.preload.output)
  }

  return defaultOutput
}

const normalizeLoaders = (loaders: Loader[] | undefined): Loader[] => {
  return loaders ?? []
}

const normalizePlugins = (plugins: Plugin | Plugin[] | undefined): Plugin[] => {
  if (!plugins) return []
  return Array.isArray(plugins) ? plugins : [plugins]
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

  const entries = resolveElectronPreloadEntries(userConfig)
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

    const preloadLoaders = normalizeLoaders(electronConfig?.preload?.loaders)
    const preloadPlugins = normalizePlugins(electronConfig?.preload?.plugins)

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
        clean: command === Command.BUILD,
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
