import { type Plugin, rspack } from '@rspack/core'
import { RsdoctorRspackPlugin } from '@rsdoctor/rspack-plugin'
import CompressionPlugin from 'compression-webpack-plugin'
import { ModuleFederationPlugin } from '@module-federation/enhanced/rspack'
import { isEmpty, isArray } from 'es-toolkit/compat'
import type { UserConfig } from '../user-config'
import type { Command } from '../compile/core/base-compile-service'
import CdnPlugin from '../plugins/cdn-plugin'

export interface PluginFactoryOptions {
  command: Command
  userConfig?: UserConfig
  isDev: boolean
  assetsDir: string
}

export class CreatePluginHelper {
  constructor(private options: PluginFactoryOptions) {}

  /** 创建源映射插件 */
  createSourceMapPlugin(): Plugin | undefined {
    const { isDev, userConfig } = this.options

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

  /** 创建CSS提取插件 */
  createCssExtractPlugin(): Plugin | undefined {
    if (this.options.isDev) {
      return
    }

    return new rspack.CssExtractRspackPlugin({
      filename: this.joinAssetsDir('assets/css/[contenthash].css'),
      ignoreOrder: true,
    })
  }

  /** 创建Doctor插件 */
  createDoctorPlugin(): Plugin | undefined {
    const { isDev, userConfig } = this.options
    if (isDev || !userConfig?.build?.outReport) {
      return
    }

    return new RsdoctorRspackPlugin()
  }

  /** 创建Gzip插件 */
  createGzipPlugin(): Plugin | undefined {
    const { isDev, userConfig } = this.options
    if (isDev || !userConfig?.build?.gzip) {
      return
    }

    return new CompressionPlugin()
  }

  /** 创建CDN插件 */
  createCdnPlugin(): Plugin | undefined {
    const { cdnOptions } = this.options.userConfig ?? {}
    if (!cdnOptions || isEmpty(cdnOptions.modules)) {
      return
    }
    return new CdnPlugin(cdnOptions)
  }

  /** 创建模块联邦插件 */
  createModuleFederationPlugin(): Plugin | Plugin[] | undefined {
    const moduleFederation = this.options.userConfig?.moduleFederation
    if (!moduleFederation) return

    if (isArray(moduleFederation)) {
      return moduleFederation.map((item) => new ModuleFederationPlugin(item))
    }
    return new ModuleFederationPlugin(moduleFederation)
  }

  /** 创建依赖循环检查插件 */
  createDependencyCyclePlugin(): Plugin | undefined {
    const { isDev, userConfig } = this.options
    if (isDev || !userConfig?.build?.dependencyCycleCheck) {
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
