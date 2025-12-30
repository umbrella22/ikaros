import type { Configuration, DefinePluginOptions } from '@rspack/core'

import {
  BaseCompileService,
  type CompileServeParame,
} from '../core/base-compile-service'
import { LoggerSystem } from '../../utils/logger'
import { runRspackBuild, startRspackDevServer } from '../../utils/rspack-runner'
import { prepareWebCompile } from './prepare-web-compile'
import {
  loadOptionalViteAdapter,
  type OptionalViteAdapter,
} from '../../utils/optional-vite'

const { error } = LoggerSystem()

export class WebCompileService extends BaseCompileService {
  private port!: number

  private viteAdapter?: OptionalViteAdapter

  private onBuildStatus?: (status: {
    success: boolean
    port?: number
    message?: string
  }) => void

  constructor(parame: CompileServeParame) {
    super(parame)
    this.onBuildStatus = parame.onBuildStatus
  }

  protected async dev() {
    const result = await this.prepare()
    if (result.bundler === 'vite') {
      await result.vite.startViteDevServer(result.config, {
        port: this.port,
        onBuildStatus: this.onBuildStatus,
      })
      return
    }

    await startRspackDevServer(result.config as Configuration, {
      port: this.port,
      onBuildStatus: this.onBuildStatus,
    })
  }

  protected async build() {
    const result = await this.prepare()
    if (result.bundler === 'vite') {
      await result.vite.runViteBuild(result.config, {
        onBuildStatus: this.onBuildStatus,
      })
      return
    }

    await runRspackBuild(result.config as Configuration, {
      onBuildStatus: this.onBuildStatus,
    })
  }

  private async prepare(): Promise<
    | {
        bundler: 'vite'
        config: unknown
        vite: OptionalViteAdapter
      }
    | {
        bundler: 'rspack'
        config: Configuration
      }
  > {
    try {
      const result = await prepareWebCompile({
        command: this.command,
        options: this.options,
        env: this.env as unknown as DefinePluginOptions,
        context: this.context,
        contextPkg: this.contextPkg,
        userConfig: this.userConfig,
        isElectron: this.isElectron,
        resolveContext: this.resolveContext,
        loadViteAdapter: () =>
          this.viteAdapter ??
          (this.viteAdapter = loadOptionalViteAdapter({
            loadContextModule: this.loadContextModule.bind(this),
          })),
      })

      this.userConfig = result.pre.userConfig
      this.port = result.pre.port

      if (result.bundler === 'vite') {
        return {
          bundler: 'vite',
          config: result.config,
          vite:
            this.viteAdapter ??
            (this.viteAdapter = loadOptionalViteAdapter({
              loadContextModule: this.loadContextModule.bind(this),
            })),
        }
      }

      return {
        bundler: 'rspack',
        config: result.config as Configuration,
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      error({ text: message })
      process.exit(0)
    }
  }

  public getDevPort() {
    return this.port
  }
}
