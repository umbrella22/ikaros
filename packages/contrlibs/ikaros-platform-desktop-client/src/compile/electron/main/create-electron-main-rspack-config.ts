import type { Configuration, DefinePluginOptions } from '@rspack/core'
import { join } from 'node:path'

import {
  Command,
  CreateLoader,
  CreatePlugins,
  extensions,
  type PackageJson,
  resolveCLI,
  type UserConfig,
} from '@ikaros-cli/ikaros'

export type CreateElectronMainRspackConfigParams = {
  command: Command
  mode?: string
  env: DefinePluginOptions
  context: string
  contextPkg?: PackageJson
  userConfig?: UserConfig
  resolveContext: (...paths: string[]) => string
}

const resolveMainEntry = (
  userConfig: UserConfig | undefined,
  resolveContext: (...paths: string[]) => string,
): string => {
  const electronConfig = userConfig?.electron
  const defaultEntry = resolveContext('src/main/index.ts')

  if (electronConfig?.main?.entry) {
    return resolveContext(electronConfig.main.entry)
  }

  return defaultEntry
}

const resolveMainOutputDir = (
  userConfig: UserConfig | undefined,
  resolveContext: (...paths: string[]) => string,
): string => {
  const electronConfig = userConfig?.electron
  const defaultOutput = resolveContext('dist/electron/main')

  if (electronConfig?.build?.outDir) {
    return join(resolveContext(electronConfig.build.outDir), 'main')
  }

  if (electronConfig?.main?.output) {
    return resolveContext(electronConfig.main.output)
  }

  return defaultOutput
}

export const createElectronMainRspackConfig = async (
  params: CreateElectronMainRspackConfigParams,
): Promise<Configuration> => {
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

  const loaderHelper = new CreateLoader({
    env,
    mode,
  })
  const pluginHelper = new CreatePlugins({
    env,
    mode,
  })

  const mainLoaders = electronConfig?.main?.loaders || userConfig?.loaders
  const mainPlugins = electronConfig?.main?.plugins || userConfig?.plugins

  const rules = loaderHelper.useDefaultScriptLoader().add(mainLoaders).end()

  const plugins = pluginHelper
    .useDefaultEnvPlugin({
      env: defineEnv,
      extEnv: userConfig?.define,
    })
    .add(mainPlugins)
    .end()

  return {
    mode: env,
    target: 'electron-main',
    context,
    entry: {
      main: resolveMainEntry(userConfig, resolveContext),
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
      // 开发/监听时不要清理目录：main 与 preload 默认共用 dist/electron/main，清理会导致 preload 丢失
      clean: command === Command.BUILD,
      path: resolveMainOutputDir(userConfig, resolveContext),
      filename: 'main.js',
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
}
