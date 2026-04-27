import type { CompileContext } from '../compile/compile-context'
import type { NormalizedConfig } from '../config/normalize-config'
import type {
  IkarosPlugin,
  ResolvedUserConfig,
  UserConfig,
} from '../config/user-config'
import {
  createIkarosPluginAPI,
  type IkarosAfterBuildContext,
  type IkarosLifecycleContext,
  type IkarosPluginHooks,
  type ModifyBundlerConfigContext,
  type ModifyIkarosConfigContext,
  type ModifyNormalizedConfigContext,
} from './plugin-api'
import { createAsyncHook, createAsyncWaterfallHook } from './hooks'

export interface CreatePluginManagerOptions {
  compileContext: CompileContext
  plugins?: IkarosPlugin[]
}

export interface PluginManagerDiagnostics {
  plugins: string[]
  hooks: {
    [K in keyof IkarosPluginHooks]: string[]
  }
}

export class PluginManager {
  private readonly compileContext: CompileContext
  private plugins: IkarosPlugin[]

  private userConfig: ResolvedUserConfig | undefined
  private normalizedConfig: NormalizedConfig | undefined
  private initialized = false

  private readonly hooks: IkarosPluginHooks = {
    modifyIkarosConfig: createAsyncWaterfallHook<
      UserConfig | undefined,
      ModifyIkarosConfigContext
    >(),
    modifyNormalizedConfig: createAsyncWaterfallHook<
      NormalizedConfig,
      ModifyNormalizedConfigContext
    >(),
    modifyRspackConfig: createAsyncWaterfallHook<
      unknown,
      ModifyBundlerConfigContext<unknown>
    >(),
    modifyViteConfig: createAsyncWaterfallHook<
      unknown,
      ModifyBundlerConfigContext<unknown>
    >(),
    onBeforeCreateCompiler: createAsyncHook<IkarosLifecycleContext>(),
    onBeforeBuild: createAsyncHook<IkarosLifecycleContext>(),
    onAfterBuild: createAsyncHook<IkarosAfterBuildContext>(),
    onCloseBuild: createAsyncHook<IkarosLifecycleContext>(),
    onBeforeStartDevServer: createAsyncHook<IkarosLifecycleContext>(),
    onAfterStartDevServer: createAsyncHook<IkarosLifecycleContext>(),
    onCloseDevServer: createAsyncHook<IkarosLifecycleContext>(),
  }

  constructor(options: CreatePluginManagerOptions) {
    this.compileContext = options.compileContext
    this.plugins = []
    this.userConfig = options.compileContext.userConfig

    for (const plugin of options.plugins ?? []) {
      if (!this.isPluginExists(plugin.name)) {
        this.plugins.push(plugin)
      }
    }
  }

  async init(): Promise<void> {
    if (this.initialized) {
      return
    }

    this.initialized = true

    for (const plugin of this.plugins) {
      await this.setupPlugin(plugin)
    }
  }

  async addPlugins(plugins: IkarosPlugin[]): Promise<void> {
    for (const plugin of plugins) {
      if (this.isPluginExists(plugin.name)) {
        continue
      }

      this.plugins.push(plugin)

      if (this.initialized) {
        await this.setupPlugin(plugin)
      }
    }
  }

  removePlugins(pluginNames: string[]): void {
    if (pluginNames.length === 0) {
      return
    }

    const names = new Set(pluginNames)
    this.plugins = this.plugins.filter((plugin) => !names.has(plugin.name))

    for (const name of names) {
      for (const hook of Object.values(this.hooks)) {
        hook.untap(name)
      }
    }
  }

  isPluginExists(pluginName: string): boolean {
    return this.plugins.some((plugin) => plugin.name === pluginName)
  }

  getPluginNames(): string[] {
    return this.plugins.map((plugin) => plugin.name)
  }

  getHookTapNames(): PluginManagerDiagnostics['hooks'] {
    return Object.fromEntries(
      Object.entries(this.hooks).map(([name, hook]) => [
        name,
        hook.getTapNames(),
      ]),
    ) as PluginManagerDiagnostics['hooks']
  }

  async applyIkarosConfig(
    config: UserConfig | undefined,
  ): Promise<ResolvedUserConfig | undefined> {
    this.userConfig = await this.hooks.modifyIkarosConfig.call(config, {
      compileContext: this.compileContext,
    })

    return this.userConfig
  }

  async applyNormalizedConfig(
    config: NormalizedConfig,
  ): Promise<NormalizedConfig> {
    this.normalizedConfig = await this.hooks.modifyNormalizedConfig.call(
      config,
      {
        compileContext: this.compileContext,
        userConfig: this.userConfig,
      },
    )

    return this.normalizedConfig
  }

  async applyBundlerConfig<TConfig>(
    bundler: 'rspack' | 'vite',
    bundlerConfig: TConfig,
  ): Promise<TConfig> {
    if (Array.isArray(bundlerConfig)) {
      const nextConfigs = []

      for (const item of bundlerConfig) {
        nextConfigs.push(await this.applyBundlerConfig(bundler, item))
      }

      return nextConfigs as TConfig
    }

    const config = this.requireNormalizedConfig()
    const hookContext: ModifyBundlerConfigContext<unknown> = {
      compileContext: this.compileContext,
      config,
      bundler,
      bundlerConfig,
    }

    if (bundler === 'vite') {
      return (await this.hooks.modifyViteConfig.call(
        bundlerConfig,
        hookContext,
      )) as TConfig
    }

    return (await this.hooks.modifyRspackConfig.call(
      bundlerConfig,
      hookContext,
    )) as TConfig
  }

  async callBeforeCreateCompiler(): Promise<void> {
    await this.hooks.onBeforeCreateCompiler.call(this.createLifecycleContext())
  }

  async callBeforeBuild(): Promise<void> {
    await this.hooks.onBeforeBuild.call(this.createLifecycleContext())
  }

  async callAfterBuild(result?: string): Promise<void> {
    await this.hooks.onAfterBuild.call({
      ...this.createLifecycleContext(),
      result,
    })
  }

  async callOnCloseBuild(): Promise<void> {
    await this.hooks.onCloseBuild.call(this.createLifecycleContext())
  }

  async callBeforeStartDevServer(): Promise<void> {
    await this.hooks.onBeforeStartDevServer.call(this.createLifecycleContext())
  }

  async callAfterStartDevServer(): Promise<void> {
    await this.hooks.onAfterStartDevServer.call(this.createLifecycleContext())
  }

  async callOnCloseDevServer(): Promise<void> {
    await this.hooks.onCloseDevServer.call(this.createLifecycleContext())
  }

  private createLifecycleContext(): IkarosLifecycleContext {
    return {
      compileContext: this.compileContext,
      config: this.requireNormalizedConfig(),
    }
  }

  private async setupPlugin(plugin: IkarosPlugin): Promise<void> {
    await plugin.setup(
      createIkarosPluginAPI({
        pluginName: plugin.name,
        compileContext: this.compileContext,
        hooks: this.hooks,
        getIkarosConfig: () => this.userConfig as UserConfig | undefined,
        getNormalizedConfig: () => this.normalizedConfig,
      }),
    )
  }

  private requireNormalizedConfig(): NormalizedConfig {
    if (!this.normalizedConfig) {
      throw new Error('[ikaros] normalized config is not ready')
    }

    return this.normalizedConfig
  }
}

export function createPluginManager(
  options: CreatePluginManagerOptions,
): PluginManager {
  return new PluginManager(options)
}
