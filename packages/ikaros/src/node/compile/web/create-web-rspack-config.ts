import type { Configuration, DefinePluginOptions } from '@rspack/core'
import { rspack } from '@rspack/core'
import { isString } from 'es-toolkit'
import { join } from 'node:path'

import type { Pages } from '../../utils/loader-plugin-helper'
import {
  CreateLoader,
  CreateMpaAssets,
  CreatePlugins,
} from '../../utils/loader-plugin-helper'
import { extensions, resolveCLI } from '../../utils/const'
import StatsPlugin from '../../plugins/stats-plugin'
import { CreatePluginHelper } from '../../utils/create-plugin-helper'
import type { UserConfig } from '../../user-config'
import type { PackageJson } from '../core/base-compile-service'
import { Command } from '../core/base-compile-service'

export type CreateWebRspackConfigParams = {
  command: Command
  mode?: string
  env: DefinePluginOptions
  context: string
  contextPkg?: PackageJson
  userConfig?: UserConfig
  pages: Pages
  browserslist: string
  base: string
  port: number
  isElectron: boolean
  isVue: boolean
  isReact: boolean
  resolveContext: (...paths: string[]) => string
}

type VueOrReactConfig = {
  noParse?: NonNullable<NonNullable<Configuration['module']>['noParse']>
  env?: DefinePluginOptions
}

const createVueOrReactConfig = (params: {
  isVue: boolean
  isReact: boolean
}): VueOrReactConfig => {
  const { isVue, isReact } = params

  if (isVue) {
    return {
      noParse: /^(vue|vue-router|vuex|vuex-router-sync)$/,
      env: {
        __VUE_OPTIONS_API__: true,
        __VUE_PROD_DEVTOOLS__: false,
        __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
      },
    }
  }

  if (isReact) {
    return {
      noParse: (content: string) => {
        return /(react|react-dom|react-is)\.production\.min\.js$/.test(content)
      },
      env: {
        REACT_APP_ENABLE_DEVTOOLS: false,
      },
    }
  }

  return {
    env: undefined,
    noParse: undefined,
  }
}

const createOptimization = (
  command: Command,
): Configuration['optimization'] => {
  if (command === Command.SERVER) {
    return {
      minimize: false,
      removeAvailableModules: false,
      removeEmptyChunks: false,
      splitChunks: false,
    }
  }

  return {
    minimize: true,
    minimizer: [
      new rspack.LightningCssMinimizerRspackPlugin(),
      new rspack.SwcJsMinimizerRspackPlugin(),
    ],
    splitChunks: {
      chunks: 'all',
      minSize: 30000,
      minChunks: 1,
      maxAsyncRequests: 5,
      maxInitialRequests: 3,
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10,
          chunks: 'all',
        },
        common: {
          name: 'common',
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true,
        },
      },
    },
  }
}

const createCacheConfig = (
  params: Pick<CreateWebRspackConfigParams, 'command' | 'userConfig'>,
): Pick<Configuration, 'cache' | 'experiments'> | undefined => {
  if (params.command === Command.SERVER) {
    return
  }
  if (!params.userConfig?.build?.cache) {
    return
  }

  return {
    cache: true,
    experiments: {
      cache: {
        type: 'persistent',
      },
    },
  }
}

const getOutDirPath = (
  params: Pick<
    CreateWebRspackConfigParams,
    'userConfig' | 'isElectron' | 'resolveContext'
  >,
): string => {
  const { userConfig, isElectron, resolveContext } = params

  const outDirName = userConfig?.build?.outDirName

  if (isElectron) {
    const electronConfig = userConfig?.electron
    const defaultOutput = resolveContext('dist/electron/renderer')

    if (electronConfig?.build?.outDir) {
      return join(resolveContext(electronConfig.build.outDir), 'renderer')
    }

    return defaultOutput
  }

  if (isString(outDirName)) {
    return resolveContext(outDirName)
  }

  return resolveContext('dist')
}

const formatAssetsPath = (assetsDir: string, path: string): string => {
  return [assetsDir, path].filter(Boolean).join('/').replace(/\/+/g, '/')
}

export const createWebRspackConfig = (
  params: CreateWebRspackConfigParams,
): Configuration => {
  const {
    command,
    mode,
    env: envVars,
    context,
    contextPkg,
    userConfig,
    pages,
    browserslist,
    base,
    port,
    isElectron,
    resolveContext,
  } = params

  const isDev = command === Command.SERVER
  const env = isDev ? 'development' : 'production'

  const loaderHelper = new CreateLoader({
    env,
    mode,
  })
  const pluginHelper = new CreatePlugins({
    env,
    mode,
  })

  const mpaAssetsHelper = new CreateMpaAssets({
    pages,
    enablePages: userConfig?.enablePages,
  })

  const { entry, plugins: mpaPlugins } = mpaAssetsHelper.create()
  const { env: frameworkEnv, noParse } = createVueOrReactConfig({
    isVue: params.isVue,
    isReact: params.isReact,
  })

  const rules = loaderHelper
    .useDefaultResourceLoader()
    .useDefaultScriptLoader(userConfig?.experiments)
    .useDefaultCssLoader(userConfig?.css)
    .add(userConfig?.loaders)
    .end()

  const assetsDir = userConfig?.build?.assetsDir ?? ''
  const createPluginHelper = new CreatePluginHelper({
    command,
    userConfig,
    isDev,
    assetsDir,
  })

  const plugins = pluginHelper
    .useDefaultEnvPlugin({
      extEnv: {
        ...userConfig?.define,
      },
      frameworkEnv,
      env: envVars,
    })
    .useCopyPlugin()
    .add(mpaPlugins)
    // .add(new StatsPlugin())
    .add(createPluginHelper.createSourceMapPlugin())
    .add(createPluginHelper.createCssExtractPlugin())
    .add(createPluginHelper.createDoctorPlugin())
    .add(createPluginHelper.createGzipPlugin())
    .add(createPluginHelper.createCdnPlugin())
    .add(createPluginHelper.createModuleFederationPlugin())
    .add(createPluginHelper.createDependencyCyclePlugin())
    .add(userConfig?.plugins)
    .end()

  return {
    mode: env,
    context,
    entry,
    target: isElectron
      ? 'electron-renderer'
      : ['web', 'es2015', `browserslist:${browserslist}`],
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
      clean: true,
      path: getOutDirPath({ userConfig, isElectron, resolveContext }),
      publicPath: isElectron ? './' : base,
      filename: isDev
        ? '[name].[contenthash:8].js'
        : formatAssetsPath(assetsDir, 'assets/js/[contenthash:8].js'),
      chunkFilename: isDev
        ? '[name].[contenthash:8].chunk.js'
        : formatAssetsPath(assetsDir, 'assets/js/[contenthash:8].chunk.js'),
      chunkLoadingGlobal: `${contextPkg?.name || 'ikaros'}_chunk`,
      pathinfo: false,
    },
    optimization: createOptimization(command),
    stats: 'none',
    watchOptions: {
      aggregateTimeout: 500,
      ignored: /node_modules/,
    },
    module: {
      rules,
      noParse,
    },
    plugins,
    devServer: {
      hot: true,
      port,
      server: (() => {
        const https = userConfig?.server?.https

        if (!https) {
          return 'http'
        }

        if (https === true) {
          return 'https'
        }

        return {
          type: 'https',
          options: https,
        }
      })(),
      allowedHosts: 'all',
      proxy: userConfig?.server?.proxy,

      historyApiFallback: {
        rewrites: [
          { from: new RegExp(`^${base}`), to: join(base, 'index.html') },
        ],
      },

      headers: {
        'Access-Control-Allow-Origin': '*',
      },

      static: {
        directory: resolveContext('public'),
        publicPath: base,
      },

      client: {
        logging: 'none',
        overlay: {
          errors: true,
          warnings: false,
          runtimeErrors: false,
        },
        webSocketURL: `auto://0.0.0.0:${port}/ws`,
      },
    },
    experiments: {
      css: true,
    },
    ...createCacheConfig({ command, userConfig }),
  } as Configuration
}
