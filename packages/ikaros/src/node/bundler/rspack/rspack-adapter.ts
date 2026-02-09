import type { Configuration, DefinePluginOptions } from '@rspack/core'

import type {
  BundlerAdapter,
  BundlerBuildOptions,
  BundlerDevOptions,
  CreateConfigParams,
} from '../types'
import { createWebRspackConfig } from '../../compile/web/create-web-rspack-config'
import { runRspackBuild, startRspackDevServer } from './rspack-runner'
import { Command } from '../../compile/compile-context'

/**
 * Rspack 编译器适配器
 *
 * 实现 BundlerAdapter<Configuration>，将现有 rspack 相关逻辑封装为统一接口
 */
export class RspackAdapter implements BundlerAdapter<Configuration> {
  readonly name = 'rspack' as const

  createConfig(params: CreateConfigParams): Configuration {
    return createWebRspackConfig({
      command: params.command === 'server' ? Command.SERVER : Command.BUILD,
      mode: params.mode,
      env: params.env as DefinePluginOptions,
      context: params.context,
      contextPkg: params.contextPkg,
      userConfig: params.userConfig,
      pages: params.pages,
      browserslist: params.browserslist,
      base: params.base,
      port: params.port,
      isElectron: params.isElectron,
      isVue: params.isVue,
      isReact: params.isReact,
      resolveContext: params.resolveContext,
    })
  }

  async runDev(
    config: Configuration,
    options: BundlerDevOptions,
  ): Promise<void> {
    await startRspackDevServer(config, {
      port: options.port,
      onBuildStatus: options.onBuildStatus,
    })
  }

  async runBuild(
    config: Configuration,
    options: BundlerBuildOptions,
  ): Promise<string | undefined> {
    return runRspackBuild(config, {
      onBuildStatus: options.onBuildStatus,
    })
  }
}
