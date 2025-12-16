import type { Configuration, DefinePluginOptions } from '@rspack/core'

import {
  BaseCompileService,
  runRspackBuild,
  watchRspackBuild,
} from '@ikaros-cli/ikaros'

import { createElectronMainRspackConfig } from './create-electron-main-rspack-config'

export class ElectronMainCompileService extends BaseCompileService {
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
    const config = await this.prepare()
    await watchRspackBuild(config, {
      onBuildStatus: this.onBuildStatus,
    })
  }

  protected async build() {
    const config = await this.prepare()
    await runRspackBuild(config, {
      onBuildStatus: this.onBuildStatus,
    })
  }

  private async prepare(): Promise<Configuration> {
    return createElectronMainRspackConfig({
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
