import chalk from 'chalk'
import {
  type DevServer,
  type Configuration,
  type Plugin,
  type Experiments,
  rspack,
} from '@rspack/core'
import { RsdoctorRspackPlugin } from '@rsdoctor/rspack-plugin'
import CompressionPlugin from 'compression-webpack-plugin'
import { ModuleFederationPlugin } from '@module-federation/enhanced/rspack'
import { isEmpty, isString, isArray } from 'radash'
import { RspackDevServer } from '@rspack/dev-server'
import { join } from 'node:path'
import { detect } from 'detect-port'

import type { UserConfig } from '../user-config'
import { BaseCompileService, Command } from './base-compile-service'
import { extensions, resolveCLI } from '../utils/const'
import {
  CreateLoader,
  CreateMpaAssets,
  CreatePlugins,
} from '../utils/loader-plugin-helper'
import StatsPlugin from '../plugins/stats-plugin'
import CdnPlugin from '../plugins/cdn-plugin'
import { errorLog } from '../utils/logger'
import { checkDependency } from '../utils/common-tools'

export class WebCompileService extends BaseCompileService {
  private userConfig?: UserConfig

  private browserslist!: string

  private rspackConfig!: Configuration

  private target!: Exclude<UserConfig['target'], undefined>

  private pages!: Exclude<UserConfig['pages'], undefined>

  private port!: DevServer['port']

  private base!: string

  private isVue: boolean = false

  private isReact: boolean = false

  protected async dev() {
    await this.initPreConfig()
    await this.createRspackBuilder({ isLive: true, config: this.rspackConfig })
  }
  protected async build() {
    await this.initPreConfig()
    await this.createRspackBuilder({
      isLive: false,
      config: this.rspackConfig,
    })
  }
  /** 初始化 */
  private async initPreConfig() {
    await this.initUserConfig()
    await this.initBrowserslist()
    await this.initOtherConfig()
    this.rspackConfig = await this.createRspackConfig()
  }
  /** 初始化配置相关 */
  private async initUserConfig() {
    const isDev = this.command === Command.SERVER

    const config = await this.getUserConfig()
    this.userConfig = config

    this.base = config?.build?.base ?? '/'

    if (isDev && isString(this.base) && /^https?:/.test(this.base)) {
      const optsText = chalk.cyan('build.base')
      errorLog(`本地开发时 ${optsText} 不应该为外部 Host!`)
      process.exit(0)
    }

    this.target = config?.target ?? 'pc'

    this.pages = config?.pages ?? {
      index: {
        html: this.resolveContext('index.html'),
        entry: this.resolveContext('src/index'),
      },
    }

    this.port = config?.server?.port ?? (await detect('8080'))
  }
  /**
   * 初始化browserslist
   */
  private async initBrowserslist() {
    const isMobile = this.target === 'mobile'

    const bl = ['defaults']

    if (isMobile) {
      bl.push('IOS >= 10', 'Chrome >= 56')
    } else {
      bl.push(
        '>0.2%',
        'Chrome >= 56',
        'Safari >= 10',
        'last 2 versions',
        'not dead',
      )
    }

    this.browserslist = bl.join(',')
  }
  /**
   * 初始化部分前端框架专属配置
   */
  private async initOtherConfig() {
    try {
      const [hasReact, hasVue] = await Promise.all([
        checkDependency('react'),
        checkDependency('vue'),
      ])
      this.isVue = hasVue
      this.isReact = hasReact
      // 吃掉报错，因为这里只是检查依赖
    } catch {}
  }

  /** 合并资源目录 */
  private joinAssetsDir(...paths: string[]) {
    const assetsDir = this.userConfig?.build?.assetsDir ?? ''
    return join(assetsDir, ...paths).replaceAll('\\', '/')
  }

  /** 获取输出目录 */
  private getOutDirPath() {
    const outDirName = this.userConfig?.build?.outDirName
    if (isString(outDirName)) {
      return this.resolveContext(outDirName)
    }
    return this.resolveContext('dist')
  }
  /** 创建rspack配置 */
  private async createRspackConfig(): Promise<Configuration> {
    const isDev = this.command === Command.SERVER
    const env = isDev ? 'development' : 'production'
    const { userConfig, context, browserslist, pages, contextPkg, port, base } =
      this
    const loaderHelper = new CreateLoader({
      env,
      mode: this.options.mode,
    })
    const pluginHelper = new CreatePlugins({
      env,
      mode: this.options.mode,
    })
    const mpaAssetsHelper = new CreateMpaAssets(pages)
    const { entry, plugins: mpaPlugins } = mpaAssetsHelper.create()
    const { env: envConfig, noParse } = this.createVueOrReactConfig()

    // 生成rules
    const rules = loaderHelper
      .useDefaultResourceLoader()
      .useDefaultScriptLoader(userConfig?.experiments)
      .useDefaultCssLoader(userConfig?.css)
      .add(userConfig?.loaders)
      .end()

    // 生成plugins
    const plugins = pluginHelper
      .useDefaultEnvPlugin(envConfig)
      .useCopyPlugin()
      .add(mpaPlugins)
      .add(new StatsPlugin())
      .add(this.createSourceMapPlugin())
      .add(this.createCssExtractPlugin())
      .add(this.createDoctorPlugin())
      .add(this.createGzipPlugin())
      .add(this.createCdnPlugin())
      .add(this.createModuleFederationPlugin())
      .add(userConfig?.plugins)
      .end()

    return {
      mode: env,
      target: ['web', 'es5', `browserslist:${browserslist}`],
      context,
      entry,
      resolve: {
        alias: {
          '@': this.resolveContext('src'),
          ...userConfig?.resolve?.alias,
        },

        extensions: userConfig?.resolve?.extensions || extensions,

        modules: [
          'node_modules',
          this.resolveContext('node_modules'),
          resolveCLI('node_modules'),
        ],
      },
      output: {
        clean: true,
        path: this.getOutDirPath(),
        publicPath: base,
        filename: isDev
          ? '[id].js'
          : this.joinAssetsDir('assets/js/[contenthash].js'),
        chunkLoadingGlobal: `${contextPkg?.name || 'ikaros'}_chunk`,
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
          directory: this.resolveContext('public'),
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
      ...this.createCacheConfig(),
    }
  }
  /** 创建插件 --start */

  /** 创建映射源插件 */
  private createSourceMapPlugin(): Plugin | undefined {
    const { userConfig, command } = this
    const isDev = command === Command.SERVER

    if (isDev) {
      return new rspack.EvalSourceMapDevToolPlugin({
        columns: false,
        module: true,
      })
    }

    if (userConfig?.build?.sourceMap ?? false) {
      return new rspack.SourceMapDevToolPlugin({
        test: [/.js/, /.mjs/],
        filename: '[file].map[query]',
      })
    }
  }
  /** 创建css分离插件 */
  private createCssExtractPlugin(): Plugin | undefined {
    if (this.command === Command.SERVER) {
      return
    }

    return new rspack.CssExtractRspackPlugin({
      filename: this.joinAssetsDir('assets/css/[contenthash].css'),
      ignoreOrder: true,
    })
  }
  /** 创建doctor插件 */
  private createDoctorPlugin(): Plugin | undefined {
    if (this.command === Command.SERVER) {
      return
    }
    if (!this.userConfig?.build?.outReport) {
      return
    }

    return new RsdoctorRspackPlugin()
  }
  /** 创建gzip插件 */
  private createGzipPlugin(): Plugin | undefined {
    if (this.command === Command.SERVER) {
      return
    }
    if (!this.userConfig?.build?.gzip) {
      return
    }

    return new CompressionPlugin()
  }
  /** 创建优化配置 */
  private createOptimization(): Configuration['optimization'] {
    if (this.command === Command.SERVER) {
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
        minSize: 20000,
        minChunks: 2,
        maxAsyncRequests: 30,
        maxInitialRequests: 30,
        cacheGroups: {
          defaultVendors: {
            test: /[/\\]node_modules[/\\]/,
            priority: -10,
            reuseExistingChunk: true,
          },
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
        },
      },
    }
  }
  /** 创建持久化cache配置 */
  private createCacheConfig():
    | { cache: boolean; experiments: Experiments }
    | undefined {
    if (this.command === Command.SERVER) {
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
  /** 创建vue或react专属配置 */
  private createVueOrReactConfig() {
    if (this.isVue) {
      return {
        noParse: /^(vue|vue-router|vuex|vuex-router-sync)$/,
        env: {
          __VUE_OPTIONS_API__: true,
          __VUE_PROD_DEVTOOLS__: false,
          __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
        },
      }
    }
    if (this.isReact) {
      return {
        noParse: (content: string) => {
          return /(react|react-dom|react-is)\.production\.min\.js$/.test(
            content,
          )
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

  /** 创建插件 --end */

  /** 创建rspack构建器 */
  private createRspackBuilder({
    isLive,
    config,
  }: {
    isLive: boolean
    config: Configuration
  }) {
    return new Promise<string | undefined>((resolve, reject) => {
      const compiler = rspack(config)
      if (isLive) {
        const server = new RspackDevServer(
          config.devServer as DevServer,
          compiler,
        )
        server.startCallback((err) => {
          if (err) {
            return reject(err)
          }
          resolve(undefined)
        })
        return
      }
      let errorMessage = ''
      compiler.run((err, stats) => {
        compiler.close((closeError) => {
          if (err || closeError) {
            console.error(err || closeError)
            return reject(err || closeError)
          }
          if (stats?.hasErrors()) {
            errorMessage += 'Build failed with errors.\n'

            stats
              .toString({
                chunks: false,
                colors: true,
              })
              .split(/\r?\n/)
              .forEach((line) => {
                errorMessage += `    ${line}\n`
              })
            return reject(new Error(errorMessage))
          }
          return resolve(
            stats?.toString({
              chunks: false,
              colors: true,
            }),
          )
        })
      })
    })
  }
}
