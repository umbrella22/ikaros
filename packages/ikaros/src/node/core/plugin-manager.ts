import type { Configuration } from '@rspack/core'
import type { BuildPlan } from '../build-plan'
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
  type IkarosPluginTraceEntry,
  type IkarosPluginHooks,
  type ModifyBuildPlanContext,
  type ModifyBuildPlansContext,
  type ModifyBundlerConfigContext,
  type ModifyIkarosConfigContext,
  type ModifyNormalizedConfigContext,
  type ViteConfigLike,
} from './plugin-api'
import { createAsyncHook, createAsyncWaterfallHook } from './hooks'
import type {
  RspackPluginRegistry,
  RspackRuleRegistry,
} from '../bundler/rspack/semantic-registry'
import { applyRspackSemanticHooks } from '../bundler/rspack/apply-rspack-semantics'
import { logger } from '../shared/logger'

export interface CreatePluginManagerOptions {
  compileContext: CompileContext
  builtinPlugins?: IkarosPlugin[]
  plugins?: IkarosPlugin[]
}

export interface PluginManagerDiagnostics {
  plugins: string[]
  hooks: {
    [K in keyof IkarosPluginHooks]: string[]
  }
}

type PluginOrigin = 'builtin' | 'user'

type PluginRecord = {
  plugin: IkarosPlugin
  origin: PluginOrigin
  index: number
}

export type PluginTraceEntry = IkarosPluginTraceEntry

export class PluginManager {
  private readonly compileContext: CompileContext
  private pluginRecords: PluginRecord[]

  private userConfig: ResolvedUserConfig | undefined
  private normalizedConfig: NormalizedConfig | undefined
  private initialized = false
  private nextPluginIndex = 0
  private readonly traces: PluginTraceEntry[] = []

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
      Configuration,
      ModifyBundlerConfigContext<Configuration>
    >(),
    modifyViteConfig: createAsyncWaterfallHook<
      ViteConfigLike,
      ModifyBundlerConfigContext<ViteConfigLike>
    >(),
    modifyBuildPlans: createAsyncWaterfallHook<
      BuildPlan[],
      ModifyBuildPlansContext
    >(),
    modifyBuildPlan: createAsyncWaterfallHook<
      BuildPlan,
      ModifyBuildPlanContext
    >(),
    modifyRspackRules: createAsyncHook<{
      rules: RspackRuleRegistry
      context: IkarosLifecycleContext
    }>(),
    modifyRspackPlugins: createAsyncHook<{
      plugins: RspackPluginRegistry
      context: IkarosLifecycleContext
    }>(),
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
    this.pluginRecords = []
    this.userConfig = options.compileContext.userConfig

    this.registerPlugins(options.builtinPlugins ?? [], 'builtin')
    this.registerPlugins(options.plugins ?? [], 'user')
  }

  async init(): Promise<void> {
    if (this.initialized) {
      return
    }

    this.initialized = true

    for (const { plugin } of this.getSortedPluginRecords()) {
      await this.setupPlugin(plugin)
    }
    this.sortHookTaps()
  }

  async addPlugins(plugins: IkarosPlugin[]): Promise<void> {
    const added = this.registerPlugins(plugins, 'user')

    if (this.initialized) {
      for (const { plugin } of this.sortPluginRecords(added)) {
        await this.setupPlugin(plugin)
      }
      this.sortHookTaps()
    }
  }

  removePlugins(pluginNames: string[]): void {
    if (pluginNames.length === 0) {
      return
    }

    const names = new Set(pluginNames)
    this.pluginRecords = this.pluginRecords.filter(
      ({ plugin }) => !names.has(plugin.name),
    )

    for (const name of names) {
      for (const hook of Object.values(this.hooks)) {
        hook.untap(name)
      }
    }
    this.sortHookTaps()
  }

  isPluginExists(pluginName: string): boolean {
    return this.pluginRecords.some(({ plugin }) => plugin.name === pluginName)
  }

  private findPluginRecord(pluginName: string): PluginRecord | undefined {
    return this.pluginRecords.find(({ plugin }) => plugin.name === pluginName)
  }

  getPluginNames(): string[] {
    return this.getSortedPluginRecords().map(({ plugin }) => plugin.name)
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
    const hookContext = {
      compileContext: this.compileContext,
      config,
      bundler,
      bundlerConfig,
    }

    if (bundler === 'vite') {
      const nextConfig = (await this.hooks.modifyViteConfig.call(
        bundlerConfig as ViteConfigLike,
        hookContext as ModifyBundlerConfigContext<ViteConfigLike>,
      )) as TConfig
      return nextConfig
    }

    const semanticConfig = await applyRspackSemanticHooks(
      bundlerConfig as Configuration,
      this,
    )
    const nextConfig = (await this.hooks.modifyRspackConfig.call(
      semanticConfig,
      {
        ...hookContext,
        bundlerConfig: semanticConfig,
      } as ModifyBundlerConfigContext<Configuration>,
    )) as TConfig
    return nextConfig
  }

  async applyBuildPlans(plans: BuildPlan[]): Promise<BuildPlan[]> {
    const context = {
      ...this.createLifecycleContext(),
      plans,
    }
    const nextPlans = await this.hooks.modifyBuildPlans.call(plans, context)
    const result: BuildPlan[] = []

    for (const plan of nextPlans) {
      result.push(
        await this.hooks.modifyBuildPlan.call(plan, {
          ...this.createLifecycleContext(),
          plan,
        }),
      )
    }

    return result
  }

  async applyRspackRules(rules: RspackRuleRegistry): Promise<void> {
    await this.hooks.modifyRspackRules.call({
      rules,
      context: this.createLifecycleContext(),
    })
  }

  async applyRspackPlugins(plugins: RspackPluginRegistry): Promise<void> {
    await this.hooks.modifyRspackPlugins.call({
      plugins,
      context: this.createLifecycleContext(),
    })
  }

  getPluginTraces(): PluginTraceEntry[] {
    return [...this.traces]
  }

  recordTrace(entry: PluginTraceEntry): void {
    this.traces.push(entry)
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
        recordTrace: (entry) => this.recordTrace(entry),
      }),
    )
  }

  private requireNormalizedConfig(): NormalizedConfig {
    if (!this.normalizedConfig) {
      throw new Error('[ikaros] normalized config is not ready')
    }

    return this.normalizedConfig
  }

  private registerPlugins(
    plugins: IkarosPlugin[],
    origin: PluginOrigin,
  ): PluginRecord[] {
    const added: PluginRecord[] = []

    for (const plugin of plugins) {
      const existing = this.findPluginRecord(plugin.name)
      if (existing) {
        if (existing.plugin !== plugin) {
          const message = `插件 ${plugin.name} 已由 ${existing.origin} 注册，跳过来自 ${origin} 的同名插件。建议运行 inspect 查看插件诊断。`
          logger.warning({ text: message })
          this.recordTrace({
            hook: 'registerPlugin',
            plugin: plugin.name,
            phase: 'warning',
            operation: 'skip-duplicate-plugin',
            target: `${existing.origin}->${origin}`,
            message,
          })
        }
        continue
      }

      const record = {
        plugin,
        origin,
        index: this.nextPluginIndex,
      }
      this.nextPluginIndex += 1
      this.pluginRecords.push(record)
      added.push(record)
    }

    return added
  }

  private getSortedPluginRecords(): PluginRecord[] {
    return this.sortPluginRecords(this.pluginRecords)
  }

  private sortPluginRecords(records: PluginRecord[]): PluginRecord[] {
    return [...records].sort((left, right) => {
      const leftRank = getPluginRank(left)
      const rightRank = getPluginRank(right)

      if (leftRank !== rightRank) {
        return leftRank - rightRank
      }

      const leftOrder = left.plugin.order ?? 0
      const rightOrder = right.plugin.order ?? 0
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder
      }

      return left.index - right.index
    })
  }

  private sortHookTaps(): void {
    const names = this.getSortedPluginRecords().map(({ plugin }) => plugin.name)

    for (const hook of Object.values(this.hooks)) {
      hook.sort(names)
    }
  }
}

function getPluginRank(record: PluginRecord): number {
  const enforce = record.plugin.enforce

  if (record.origin === 'builtin' && enforce === 'pre') return 0
  if (record.origin === 'user' && enforce === 'pre') return 1
  if (enforce === undefined) return 2
  if (record.origin === 'user' && enforce === 'post') return 3
  return 4
}

export function createPluginManager(
  options: CreatePluginManagerOptions,
): PluginManager {
  return new PluginManager(options)
}
