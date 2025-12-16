import type { Configuration, DefinePluginOptions } from '@rspack/core'

import {
  BaseCompileService,
  runRspackBuild,
  watchRspackBuild,
} from '@ikaros-cli/ikaros'

import { createElectronMainRspackConfig } from './main/create-electron-main-rspack-config.js'
import { createElectronPreloadRspackConfigs } from './preload/create-electron-preload-rspack-configs.js'

const disableOutputClean = (config: Configuration): Configuration => {
  const output = config.output

  if (!output || typeof output !== 'object') return config

  // 避免 main/preload 共用输出目录时并发 clean 导致输出被误删/目录竞争
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

export class ElectronMainPreloadCompileService extends BaseCompileService {
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
    const configs = await this.prepare()
    await watchRspackBuild(configs, {
      onBuildStatus: this.onBuildStatus,
    })
  }

  protected async build() {
    const configs = await this.prepare()
    await runRspackBuild(configs, {
      onBuildStatus: this.onBuildStatus,
    })
  }

  private async prepare(): Promise<Configuration[]> {
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

    const mainConfig = disableOutputClean(mainConfigRaw)
    const preloadConfigs = preloadEntries.map((e) => e.config)

    return [mainConfig, ...preloadConfigs]
  }
}
