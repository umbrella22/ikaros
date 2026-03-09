import { rm } from 'node:fs/promises'

import type { Configuration, DefinePluginOptions } from '@rspack/core'

import type {
  BundlerAdapter,
  BundlerBuildOptions,
  BundlerDevOptions,
  CreateConfigParams,
} from '../types'
import { createWebRspackConfig } from '../../compile/web/create-web-rspack-config'
import { createLibraryRspackConfigs } from './create-library-rspack-config'
import { runRspackBuild, startRspackDevServer } from './rspack-runner'
import { Command } from '../../compile/compile-context'

/**
 * Rspack 编译器适配器
 *
 * 实现 BundlerAdapter<Configuration | Configuration[]>，将现有 rspack 相关逻辑封装为统一接口。
 * 库模式下 createConfig 可能返回 Configuration[]（多格式构建）。
 */
export class RspackAdapter implements BundlerAdapter<
  Configuration | Configuration[]
> {
  readonly name = 'rspack' as const

  createConfig(params: CreateConfigParams): Configuration | Configuration[] {
    // 库模式：build 命令 + 配置了 library
    if (params.command === 'build' && params.userConfig?.library) {
      return createLibraryRspackConfigs(params)
    }

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
      preWarnings: params.preWarnings,
    })
  }

  async runDev(
    config: Configuration | Configuration[],
    options: BundlerDevOptions,
  ): Promise<void> {
    // Dev 模式始终使用单一配置
    const singleConfig = Array.isArray(config) ? config[0] : config
    await startRspackDevServer(singleConfig, {
      port: options.port,
      onBuildStatus: options.onBuildStatus,
    })
  }

  async runBuild(
    config: Configuration | Configuration[],
    options: BundlerBuildOptions,
  ): Promise<string | undefined> {
    // 构建前主动清理输出目录，避免 rspack 内部 rmdir 在目录不存在时抛出 ENOENT
    const configs = Array.isArray(config) ? config : [config]
    const outDir = configs[0]?.output?.path
    if (outDir) {
      await rm(outDir, { recursive: true, force: true })
    }

    return runRspackBuild(config, {
      onBuildStatus: options.onBuildStatus,
    })
  }
}
