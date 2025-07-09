import {
  type DevServer,
  type Configuration,
  type Plugin,
  type Experiments,
  rspack,
} from '@rspack/core'
import { RsdoctorRspackPlugin } from '@rsdoctor/rspack-plugin'
import CompressionPlugin from 'compression-webpack-plugin'
import ESLintPlugin from 'eslint-webpack-plugin'
import stylelintPlugin from 'stylelint-webpack-plugin'
import { isArray, isEmpty } from 'radashi'
import { RspackDevServer } from '@rspack/dev-server'
import { join } from 'node:path'

import { Command } from '../compile/base-compile-service'
import { extensions } from '../utils/const'
import {
  CreateLoader,
  CreateMpaAssets,
  CreatePlugins,
} from '../utils/loaders-plugins-helper'
import StatsPlugin from '../plugins/stats-plugin'
import CdnPlugin from '../plugins/cdn-plugin'
import { resolveCLI } from '../utils/const'
import { IEngineService } from './base-service'
import { ModuleFederationPlugin } from '@module-federation/enhanced/rspack'

export class RspackService extends IEngineService {
  /** 创建映射源插件 */
  private createSourceMapPlugin(): Plugin | undefined {
    const isDev = this.resolvedContext.command === Command.SERVER

    if (isDev) {
      return new rspack.EvalSourceMapDevToolPlugin({
        columns: false,
        module: true,
      })
    }

    if (this.userConfig?.build?.sourceMap ?? false) {
      return new rspack.SourceMapDevToolPlugin({
        test: [/.js/, /.mjs/],
        filename: '[file].map[query]',
      })
    }
  }

  /** 创建css分离插件 */
  private createCssExtractPlugin(): Plugin | undefined {
    if (this.resolvedContext.command === Command.SERVER) {
      return
    }

    return new rspack.CssExtractRspackPlugin({
      filename: this.joinAssetsDir('assets/css/[contenthash].css'),
      ignoreOrder: true,
    })
  }

  /** 创建eslint插件 */
  private createEslintPlugin(): Plugin[] | undefined {
    const eslint = this.userConfig?.eslint || false
    const stylelint = this.userConfig?.stylelint || false
    const isDev = this.resolvedContext.command === Command.SERVER
    const pluginArray = []
    if (eslint) {
      pluginArray.push(
        new ESLintPlugin({
          context: this.resolvedContext.context,
          eslintPath: this.resolvedContext.resolveContext(
            'node_modules/eslint',
          ),
          extensions: ['js', 'vue', 'ts', 'tsx'],
          fix: eslint === 'fix',
          cache: true,
          threads: true,
          lintDirtyModulesOnly: isDev,
          failOnError: false,
          failOnWarning: false,
        }),
      )
    }
    if (stylelint) {
      pluginArray.push(
        new stylelintPlugin({
          context: this.resolvedContext.context,
          extensions: ['css', 'scss', 'less', 'vue'],
          fix: stylelint === 'fix',
          cache: true,
          threads: true,
          lintDirtyModulesOnly: isDev,
          failOnError: false,
          failOnWarning: false,
        }),
      )
    }
    return pluginArray
  }

  /** 创建doctor插件 */
  private createDoctorPlugin(): Plugin | undefined {
    if (this.resolvedContext.command === Command.SERVER) {
      return
    }
    if (!this.userConfig?.build?.outReport) {
      return
    }

    return new RsdoctorRspackPlugin()
  }

  /** 创建gzip插件 */
  private createGzipPlugin(): Plugin | undefined {
    if (this.resolvedContext.command === Command.SERVER) {
      return
    }
    if (!this.userConfig?.build?.gzip) {
      return
    }

    return new CompressionPlugin()
  }

  /** 创建优化配置 */
  private createOptimization(): Configuration['optimization'] {
    if (this.resolvedContext.command === Command.SERVER) {
      return {
        minimize: false,
        removeEmptyChunks: false,
        splitChunks: false,
      }
    }
    return {
      minimize: true,
      splitChunks: {
        chunks: 'async',
        minSize: 20000,
        minChunks: 2,
        cacheGroups: {
          defaultVendors: {
            name: 'chunk-vendors',
            test: /[\\/]node_modules[\\/]/,
            priority: -10,
            reuseExistingChunk: true,
            chunks: 'initial',
          },
          default: {
            name: 'chunk-common',
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
            chunks: 'initial',
          },
        },
      },
    }
  }

  /** 创建持久化cache配置 */
  private createCacheConfig():
    | { cache: boolean; experiments: Experiments }
    | undefined {
    if (this.resolvedContext.command === Command.SERVER) {
      return
    }
    if (!this.userConfig?.build?.cache) {
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

  /** 创建cdn配置 */
  private createCdnPlugin(): Plugin | undefined {
    const { cdnOptions } = this.userConfig ?? {}
    if (!cdnOptions || isEmpty(cdnOptions.modules)) {
      return
    }
    return new CdnPlugin(cdnOptions)
  }

  /** 创建模块联邦插件 */
  private createModuleFederationPlugin(): Plugin | Plugin[] | undefined {
    const moduleFederation = this.userConfig?.moduleFederation
    if (!moduleFederation) return
    if (isArray(moduleFederation)) {
      return moduleFederation.map((item) => new ModuleFederationPlugin(item))
    }
    return new ModuleFederationPlugin(moduleFederation)
  }

  /** 创建限制最大代码块数量 */
  private createLimitChunksPlugin(): Plugin | undefined {
    if (this.resolvedContext.command === Command.SERVER) {
      return
    }
    if (!this.userConfig?.build?.maxChunks) {
      return
    }
    let maxChunks = this.userConfig?.build?.maxChunks ?? 1
    if ((typeof maxChunks === 'boolean' && !maxChunks) || maxChunks < 1) {
      maxChunks = 1
    }
    return new rspack.optimize.LimitChunkCountPlugin({
      maxChunks,
    })
  }

  /** 创建依赖循环检查插件 */
  private createDependencyCyclePlugin(): Plugin | undefined {
    if (this.resolvedContext.command === Command.SERVER) {
      return
    }
    if (!this.userConfig?.build?.dependencyCycleCheck) {
      return
    }
    return new rspack.CircularDependencyRspackPlugin({
      exclude: /node_modules/,
      failOnError: false,
    })
  }

  /** 创建rspack配置 */
  private async createRspackConfig(): Promise<Configuration> {
    const isDev = this.resolvedContext.command === Command.SERVER
    const env = isDev ? 'development' : 'production'

    const loaderHelper = new CreateLoader({
      env,
      mode: this.resolvedContext.options.mode,
    })
    const pluginHelper = new CreatePlugins({
      env,
      mode: this.resolvedContext.options.mode,
    })
    const mpaAssetsHelper = new CreateMpaAssets({
      pages: this.pages,
      enablePages: this.userConfig?.enablePages,
    })
    const { entry, plugins: mpaPlugins } = mpaAssetsHelper.create()

    // 生成rules
    const rules = loaderHelper
      .useDefaultResourceLoader()
      .useDefaultScriptLoader(this.userConfig?.experiments)
      .useDefaultCssLoader(this.userConfig?.css)
      .add(this.userConfig?.loaders)
      .end()

    // 生成plugins
    const plugins = pluginHelper
      .useDefaultEnvPlugin({
        extEnv: {
          CLI_VER: this.resolvedContext.version,
          ...this.userConfig?.define,
        },
        frameworkEnv: {
          __VUE_OPTIONS_API__: true,
          __VUE_PROD_DEVTOOLS__: false,
          __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
        },
        env: this.resolvedContext.env,
      })
      .useCopyPlugin()
      .add(mpaPlugins)
      .add(
        new StatsPlugin({
          pages: this.pages,
          base: this.base,
          gzip: this.userConfig?.build?.gzip ?? false,
        }),
      )
      .add(this.createSourceMapPlugin())
      .add(this.createDoctorPlugin())
      .add(this.createGzipPlugin())
      .add(this.createCdnPlugin())
      .add(this.createModuleFederationPlugin())
      .add(this.createEslintPlugin())
      .add(this.createLimitChunksPlugin())
      .add(this.createDependencyCyclePlugin())
      .add(this.userConfig?.plugins)
      .end()

    return {
      mode: env,
      target: ['web', 'es5', `browserslist:${this.browserslist}`],
      context: this.resolvedContext.context,
      entry,
      resolve: {
        alias: {
          vue$: this.vueMajor === 3 ? 'vue' : 'vue/dist/vue.runtime.esm.js',
          '@': this.resolvedContext.resolveContext('src'),
          ...this.userConfig?.resolve?.alias,
        },

        extensions: this.userConfig?.resolve?.extensions || extensions,

        modules: [
          'node_modules',
          this.resolvedContext.resolveContext('node_modules'),
          resolveCLI('node_modules'),
        ],
      },
      output: {
        clean: true,
        path: this.getOutDirPath(),
        publicPath: this.base,
        filename: isDev
          ? '[id].js'
          : this.joinAssetsDir('assets/js/[name].[contenthash].js'),
        chunkLoadingGlobal: `${
          this.resolvedContext.contextPkg?.name || 'ikaros'
        }_chunk`,
        pathinfo: false,
      },
      optimization: this.createOptimization(),
      stats: 'none',
      watchOptions: {
        aggregateTimeout: 500,
        ignored: /node_modules/,
      },
      module: {
        rules,
        noParse: /^(vue|vue-router|vuex|vuex-router-sync)$/,
      },
      plugins,
      devServer: {
        hot: true,
        port: this.port,
        server: (() => {
          const https = this.userConfig?.server?.https

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
        proxy: this.userConfig?.server?.proxy,

        historyApiFallback: {
          rewrites: [
            {
              from: new RegExp(`^${this.base}`),
              to: join(this.base, 'index.html'),
            },
          ],
        },

        headers: {
          'Access-Control-Allow-Origin': '*',
        },

        static: {
          directory: this.resolvedContext.resolveContext('public'),
          publicPath: this.base,
        },

        client: {
          logging: 'none',
          overlay: {
            errors: true,
            warnings: false,
            runtimeErrors: false,
          },
          webSocketURL: `auto://0.0.0.0:${this.port}/ws`,
        },
      },
      experiments: {
        css: true,
        lazyCompilation: true,
        parallelLoader: true,
        incremental: true,
      },
      ...this.createCacheConfig(),
    }
  }

  /** 创建rspack构建器 */
  private async createRspackBuilder({
    isLive,
    config,
  }: {
    isLive?: boolean
    config: Configuration
  }) {
    return new Promise<string | undefined>((resolve, reject) => {
      const compiler = rspack(config)
      if (isLive) {
        this.devServer = new RspackDevServer(
          config.devServer as DevServer,
          compiler,
        )
        this.devServer.startCallback((err) => {
          if (err) {
            return reject(err)
          }
          resolve(undefined)
        })
        return
      }
      compiler.run((err, stats) => {
        compiler.close((closeError) => {
          if (err || closeError) {
            process.exit(2)
          }
          if (stats?.hasErrors()) {
            this.logger.error({
              text: 'Build failed with errors.',
            })
            process.exit(2)
          }
          return resolve(
            stats?.toString({
              timings: true,
              colors: true,
            }),
          )
        })
      })
    })
  }

  public async restartServer() {
    if (this.devServer) {
      await this.devServer.stop()
      const config = await this.createRspackConfig()
      await this.createRspackBuilder({
        isLive: true,
        config,
      })
    }
  }

  public async serve() {
    const config = await this.createRspackConfig()
    await this.createRspackBuilder({ isLive: true, config })
  }

  public async build() {
    const config = await this.createRspackConfig()
    await this.createRspackBuilder({
      config,
    })
  }
}
