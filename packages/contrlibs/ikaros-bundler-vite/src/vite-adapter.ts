import type { InlineConfig } from 'vite'

import { createViteConfig } from './config/create-vite-config'
import { runViteBuild, startViteDevServer } from './runner/vite-runner'
import type {
  BundlerAdapter,
  BundlerBuildOptions,
  BundlerDevOptions,
  CreateConfigParams,
} from './types'

/**
 * Vite 编译器适配器
 *
 * 直接实现 BundlerAdapter<InlineConfig> 接口，
 * 可被主包直接实例化使用。
 *
 * @example
 * ```ts
 * const adapter = new ViteBundlerAdapter()
 * const config = adapter.createConfig(params)
 * await adapter.runDev(config, { port: 3000 })
 * ```
 */
export class ViteBundlerAdapter implements BundlerAdapter<InlineConfig> {
  readonly name = 'vite' as const

  createConfig(params: CreateConfigParams): InlineConfig {
    return createViteConfig(params)
  }

  async runDev(
    config: InlineConfig,
    options: BundlerDevOptions,
  ): Promise<void> {
    await startViteDevServer(config, {
      port: options.port,
      onBuildStatus: options.onBuildStatus,
    })
  }

  async runBuild(
    config: InlineConfig,
    options: BundlerBuildOptions,
  ): Promise<string | undefined> {
    return runViteBuild(config, {
      onBuildStatus: options.onBuildStatus,
    })
  }
}
