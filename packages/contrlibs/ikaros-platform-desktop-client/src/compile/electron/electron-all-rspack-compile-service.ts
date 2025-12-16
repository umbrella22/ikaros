import type { Configuration, DefinePluginOptions } from '@rspack/core'
import { promises as fsp } from 'node:fs'

import {
  BaseCompileService,
  loadOptionalViteAdapter,
  prepareWebCompile,
  runRspackBuild,
} from '@ikaros-cli/ikaros'

import { createElectronMainRspackConfig } from './main/create-electron-main-rspack-config.js'
import { createElectronPreloadRspackConfigs } from './preload/create-electron-preload-rspack-configs.js'

const disableOutputClean = (config: Configuration): Configuration => {
  const output = config.output

  if (!output || typeof output !== 'object') return config

  if ('clean' in output && output.clean) {
    return {
      ...config,
      output: {
        ...output,
        clean: false,
      },
    }
  }

  return config
}

const tryCleanDir = async (dir: string | undefined) => {
  if (!dir) return

  try {
    await fsp.rm(dir, { recursive: true, force: true })
  } catch {
    // ignore
  }
}

export class ElectronAllRspackCompileService extends BaseCompileService {
  private onBuildStatus?: (status: {
    success: boolean
    port?: number
    message?: string
  }) => void

  constructor(parame: ConstructorParameters<typeof BaseCompileService>[0]) {
    super(parame)
    this.onBuildStatus = parame.onBuildStatus
  }

  protected async dev() {
    throw new Error(
      'ElectronAllRspackCompileService does not support dev mode.',
    )
  }

  protected async build() {
    const { configs, mainOutDir } = await this.prepareAll()

    // 统一在构建前清理 main/preload 输出目录，避免并发 clean 引发目录竞争/误删
    await tryCleanDir(mainOutDir)

    await runRspackBuild(configs, {
      onBuildStatus: this.onBuildStatus,
    })
  }

  private async prepareAll(): Promise<{
    configs: Configuration[]
    mainOutDir?: string
  }> {
    const mainConfigRaw = await createElectronMainRspackConfig({
      command: this.command,
      mode: this.options.mode,
      env: this.env as unknown as DefinePluginOptions,
      context: this.context,
      contextPkg: this.contextPkg,
      userConfig: this.userConfig,
      resolveContext: this.resolveContext,
    })

    const preloadEntries = await createElectronPreloadRspackConfigs({
      command: this.command,
      mode: this.options.mode,
      env: this.env as unknown as DefinePluginOptions,
      context: this.context,
      contextPkg: this.contextPkg,
      userConfig: this.userConfig,
      resolveContext: this.resolveContext,
    })

    const web = await prepareWebCompile({
      command: this.command,
      options: this.options,
      env: this.env as unknown as DefinePluginOptions,
      context: this.context,
      contextPkg: this.contextPkg,
      userConfig: this.userConfig,
      isElectron: true,
      resolveContext: this.resolveContext,
      loadViteAdapter: () =>
        loadOptionalViteAdapter({
          loadContextModule: this.loadContextModule.bind(this),
        }),
    })

    if (web.bundler !== 'rspack') {
      throw new Error(
        `ElectronAllRspackCompileService requires bundler='rspack', got '${web.bundler}'.`,
      )
    }

    const rendererConfig = web.config as Configuration

    const mainConfig = disableOutputClean(mainConfigRaw)
    const preloadConfigs = preloadEntries.map((e) => e.config)

    const mainOutDir =
      mainConfig.output &&
      typeof mainConfig.output === 'object' &&
      'path' in mainConfig.output
        ? (mainConfig.output.path as string | undefined)
        : undefined

    return {
      configs: [mainConfig, ...preloadConfigs, rendererConfig],
      mainOutDir,
    }
  }
}
