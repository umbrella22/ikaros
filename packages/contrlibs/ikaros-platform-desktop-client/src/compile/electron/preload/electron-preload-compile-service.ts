import type { DefinePluginOptions } from '@rspack/core'

import {
  BaseCompileService,
  LoggerSystem,
  runRspackBuild,
  watchRspackBuild,
} from '@ikaros-cli/ikaros'

import {
  createElectronPreloadRspackConfigs,
  type ElectronPreloadEntryConfigs,
} from './create-electron-preload-rspack-configs'

const { info } = LoggerSystem()

export class ElectronPreloadCompileService extends BaseCompileService {
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
    const entries = await this.prepare()
    await Promise.all(
      entries.map(async ({ name, config }) => {
        info({ text: `开始监听预加载脚本: ${name}` })
        await watchRspackBuild(config, {
          onBuildStatus: this.onBuildStatus,
        })
        info({ text: `预加载脚本 ${name} 构建完成` })
      }),
    )
  }

  protected async build() {
    const entries = await this.prepare()

    const results = await Promise.all(
      entries.map(async ({ name, config }) => {
        info({ text: `开始构建预加载脚本: ${name}` })
        const result = await runRspackBuild(config, {
          onBuildStatus: this.onBuildStatus,
        })
        info({ text: `预加载脚本 ${name} 构建完成` })
        return result
      }),
    )

    return results.filter(Boolean).join('\n')
  }

  private async prepare(): Promise<ElectronPreloadEntryConfigs> {
    return createElectronPreloadRspackConfigs({
      command: this.command,
      mode: this.options.mode,
      env: this.env as unknown as DefinePluginOptions,
      context: this.context,
      contextPkg: this.contextPkg,
      userConfig: this.userConfig,
      resolveContext: this.resolveContext,
    })
  }
}
