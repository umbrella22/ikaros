import { type Plugin, rspack } from '@rspack/core'
import { RsdoctorRspackPlugin } from '@rsdoctor/rspack-plugin'
import CompressionPlugin from 'compression-webpack-plugin'
import { ModuleFederationPlugin } from '@module-federation/enhanced/rspack'
import { isEmpty, isArray } from 'es-toolkit/compat'
import type { NormalizedConfig } from '../../config/normalize-config'
import type { Command } from '../../compile/compile-context'
import CdnPlugin from '../../plugins/cdn-plugin'
import { ASSET_PATHS } from '../../shared/constants'

export interface PluginFactoryOptions {
  command: Command
  config: NormalizedConfig
  isDev: boolean
  assetsDir: string
  context: string
}

export class CreatePluginHelper {
  constructor(private options: PluginFactoryOptions) {}

  private getRspackConfig() {
    return this.options.config.rspack
  }

  /** 创建源映射插件 */
  createSourceMapPlugin(): Plugin | undefined {
    const { isDev, config } = this.options

    if (isDev) {
      return new rspack.EvalSourceMapDevToolPlugin({
        columns: false,
        module: true,
      })
    }

    if (config.build.sourceMap) {
      return new rspack.SourceMapDevToolPlugin({
        test: [/.js/, /.mjs/],
        filename: '[file].map[query]',
      })
    }
  }

  /** 创建CSS提取插件 */
  createCssExtractPlugin(): Plugin | undefined {
    if (this.options.isDev) {
      return
    }

    return new rspack.CssExtractRspackPlugin({
      filename: this.joinAssetsDir(ASSET_PATHS.cssExtract),
      ignoreOrder: true,
    })
  }

  /** 创建Doctor插件 */
  createDoctorPlugin(): Plugin | undefined {
    const { isDev, config } = this.options
    if (isDev || !config.build.outReport) {
      return
    }

    return new RsdoctorRspackPlugin()
  }

  /** 创建Gzip插件 */
  createGzipPlugin(): Plugin | undefined {
    const { isDev, config } = this.options
    if (isDev || !config.build.gzip) {
      return
    }

    return new CompressionPlugin()
  }

  /** 创建CDN插件 */
  createCdnPlugin(): Plugin | undefined {
    const { cdnOptions } = this.getRspackConfig()
    if (isEmpty(cdnOptions.modules)) {
      return
    }
    return new CdnPlugin({
      ...cdnOptions,
      context: this.options.context,
    })
  }

  /** 创建模块联邦插件 */
  createModuleFederationPlugin(): Plugin | Plugin[] | undefined {
    const moduleFederation = this.getRspackConfig().moduleFederation
    if (moduleFederation.length === 0) return

    if (isArray(moduleFederation)) {
      return moduleFederation.map((item) => new ModuleFederationPlugin(item))
    }
    return new ModuleFederationPlugin(moduleFederation)
  }

  /** 创建依赖循环检查插件 */
  createDependencyCyclePlugin(): Plugin | undefined {
    const { isDev, config } = this.options
    if (isDev || !config.build.dependencyCycleCheck) {
      return
    }

    return new rspack.CircularDependencyRspackPlugin({
      exclude: /node_modules/,
      failOnError: false,
    })
  }

  /** 合并资源目录 */
  private joinAssetsDir(...paths: string[]): string {
    return [this.options.assetsDir, ...paths].join('/').replace(/\/+/g, '/')
  }
}
