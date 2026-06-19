import type { Configuration } from '@rspack/core'
import type { CompileContext } from '../compile/compile-context'
import type { NormalizedConfig } from '../config/normalize-config'
import type { UserConfig } from '../config/user-config'
import type { BuildPlan } from '../build-plan'
import type {
  RspackPluginRegistry,
  RspackRuleRegistry,
} from '../bundler/rspack/semantic-registry'
import type { AsyncHook, AsyncWaterfallHook } from './hooks'

export interface ModifyIkarosConfigContext {
  readonly compileContext: CompileContext
}

export interface ModifyNormalizedConfigContext {
  readonly compileContext: CompileContext
  readonly userConfig?: UserConfig
}

export interface IkarosLifecycleContext {
  readonly compileContext: CompileContext
  readonly config: NormalizedConfig
}

export interface ModifyBuildPlansContext extends IkarosLifecycleContext {
  readonly plans: BuildPlan[]
}

export interface ModifyBuildPlanContext extends IkarosLifecycleContext {
  readonly plan: BuildPlan
}

export interface IkarosAfterBuildContext extends IkarosLifecycleContext {
  readonly result?: string
}

export interface ModifyBundlerConfigContext<
  TConfig = unknown,
> extends IkarosLifecycleContext {
  readonly bundler: 'rspack' | 'vite'
  readonly bundlerConfig: TConfig
}

export type ModifyIkarosConfigHandler = (
  config: UserConfig | undefined,
  context: ModifyIkarosConfigContext,
) => UserConfig | undefined | Promise<UserConfig | undefined>

export type ModifyNormalizedConfigHandler = (
  config: NormalizedConfig,
  context: ModifyNormalizedConfigContext,
) => NormalizedConfig | Promise<NormalizedConfig>

export type ModifyBundlerConfigHandler<TConfig = unknown> = (
  bundlerConfig: TConfig,
  context: ModifyBundlerConfigContext<TConfig>,
) => TConfig | Promise<TConfig>

export interface ViteConfigLike {
  root?: string
  base?: string
  mode?: string
  define?: Record<string, unknown>
  plugins?: unknown
  resolve?: {
    alias?: unknown
    extensions?: string[]
    [key: string]: unknown
  }
  server?: {
    port?: number
    host?: string | boolean
    proxy?: Record<string, unknown>
    https?: boolean | Record<string, unknown>
    [key: string]: unknown
  }
  build?: {
    outDir?: string
    assetsDir?: string
    sourcemap?: boolean | 'inline' | 'hidden'
    emptyOutDir?: boolean
    lib?: unknown
    rollupOptions?: unknown
    [key: string]: unknown
  }
  [key: string]: unknown
}

export type ModifyRspackConfigHandler =
  ModifyBundlerConfigHandler<Configuration>

export type ModifyViteConfigHandler = ModifyBundlerConfigHandler<ViteConfigLike>

export type ModifyBuildPlansHandler = (
  plans: BuildPlan[],
  context: ModifyBuildPlansContext,
) => BuildPlan[] | Promise<BuildPlan[]>

export type ModifyBuildPlanHandler = (
  plan: BuildPlan,
  context: ModifyBuildPlanContext,
) => BuildPlan | Promise<BuildPlan>

export type ModifyRspackRulesHandler = (
  rules: RspackRuleRegistry,
  context: IkarosLifecycleContext,
) => void | Promise<void>

export type ModifyRspackPluginsHandler = (
  plugins: RspackPluginRegistry,
  context: IkarosLifecycleContext,
) => void | Promise<void>

export type IkarosLifecycleHandler = (
  context: IkarosLifecycleContext,
) => void | Promise<void>

export type IkarosAfterBuildHandler = (
  context: IkarosAfterBuildContext,
) => void | Promise<void>

export interface IkarosPluginHooks {
  readonly modifyIkarosConfig: AsyncWaterfallHook<
    UserConfig | undefined,
    ModifyIkarosConfigContext
  >
  readonly modifyNormalizedConfig: AsyncWaterfallHook<
    NormalizedConfig,
    ModifyNormalizedConfigContext
  >
  readonly modifyRspackConfig: AsyncWaterfallHook<
    Configuration,
    ModifyBundlerConfigContext<Configuration>
  >
  readonly modifyViteConfig: AsyncWaterfallHook<
    ViteConfigLike,
    ModifyBundlerConfigContext<ViteConfigLike>
  >
  readonly modifyBuildPlans: AsyncWaterfallHook<
    BuildPlan[],
    ModifyBuildPlansContext
  >
  readonly modifyBuildPlan: AsyncWaterfallHook<BuildPlan, ModifyBuildPlanContext>
  readonly modifyRspackRules: AsyncHook<{
    rules: RspackRuleRegistry
    context: IkarosLifecycleContext
  }>
  readonly modifyRspackPlugins: AsyncHook<{
    plugins: RspackPluginRegistry
    context: IkarosLifecycleContext
  }>
  readonly onBeforeCreateCompiler: AsyncHook<IkarosLifecycleContext>
  readonly onBeforeBuild: AsyncHook<IkarosLifecycleContext>
  readonly onAfterBuild: AsyncHook<IkarosAfterBuildContext>
  readonly onCloseBuild: AsyncHook<IkarosLifecycleContext>
  readonly onBeforeStartDevServer: AsyncHook<IkarosLifecycleContext>
  readonly onAfterStartDevServer: AsyncHook<IkarosLifecycleContext>
  readonly onCloseDevServer: AsyncHook<IkarosLifecycleContext>
}

export interface IkarosPluginTraceEntry {
  hook: keyof IkarosPluginHooks | 'registerPlugin'
  plugin: string
  phase: string
  operation: string
  target?: string
  message?: string
}

export type IkarosPluginTraceReporter = (entry: IkarosPluginTraceEntry) => void

export interface IkarosPluginAPI {
  readonly context: string
  readonly command: CompileContext['command']
  readonly platform: CompileContext['options']['platform']
  modifyIkarosConfig: (handler: ModifyIkarosConfigHandler) => void
  modifyNormalizedConfig: (handler: ModifyNormalizedConfigHandler) => void
  modifyRspackConfig: (handler: ModifyRspackConfigHandler) => void
  modifyViteConfig: (handler: ModifyViteConfigHandler) => void
  modifyBuildPlans: (handler: ModifyBuildPlansHandler) => void
  modifyBuildPlan: (handler: ModifyBuildPlanHandler) => void
  modifyRspackRules: (handler: ModifyRspackRulesHandler) => void
  modifyRspackPlugins: (handler: ModifyRspackPluginsHandler) => void
  onBeforeCreateCompiler: (handler: IkarosLifecycleHandler) => void
  onBeforeBuild: (handler: IkarosLifecycleHandler) => void
  onAfterBuild: (handler: IkarosAfterBuildHandler) => void
  onCloseBuild: (handler: IkarosLifecycleHandler) => void
  onBeforeStartDevServer: (handler: IkarosLifecycleHandler) => void
  onAfterStartDevServer: (handler: IkarosLifecycleHandler) => void
  onCloseDevServer: (handler: IkarosLifecycleHandler) => void
  getIkarosConfig: () => UserConfig | undefined
  getNormalizedConfig: () => NormalizedConfig | undefined
}

export function createIkarosPluginAPI(params: {
  pluginName: string
  compileContext: CompileContext
  hooks: IkarosPluginHooks
  getIkarosConfig: () => UserConfig | undefined
  getNormalizedConfig: () => NormalizedConfig | undefined
  recordTrace?: IkarosPluginTraceReporter
}): IkarosPluginAPI {
  const {
    pluginName,
    compileContext,
    hooks,
    getIkarosConfig,
    getNormalizedConfig,
    recordTrace,
  } = params

  return {
    context: compileContext.context,
    command: compileContext.command,
    platform: compileContext.options.platform,

    modifyIkarosConfig(handler) {
      hooks.modifyIkarosConfig.tap(pluginName, handler)
    },

    modifyNormalizedConfig(handler) {
      hooks.modifyNormalizedConfig.tap(pluginName, handler)
    },

    modifyRspackConfig(handler) {
      hooks.modifyRspackConfig.tap(pluginName, async (config, context) => {
        recordTrace?.({
          hook: 'modifyRspackConfig',
          plugin: pluginName,
          phase: 'bundler-config',
          operation: 'apply',
        })
        return handler(config, context)
      })
    },

    modifyViteConfig(handler) {
      hooks.modifyViteConfig.tap(pluginName, async (config, context) => {
        recordTrace?.({
          hook: 'modifyViteConfig',
          plugin: pluginName,
          phase: 'bundler-config',
          operation: 'apply',
        })
        return handler(config, context)
      })
    },

    modifyBuildPlans(handler) {
      hooks.modifyBuildPlans.tap(pluginName, async (plans, context) => {
        recordTrace?.({
          hook: 'modifyBuildPlans',
          plugin: pluginName,
          phase: 'build-plan',
          operation: 'apply',
          target: plans.map((plan) => plan.id).join(','),
        })
        return handler(plans, context)
      })
    },

    modifyBuildPlan(handler) {
      hooks.modifyBuildPlan.tap(pluginName, async (plan, context) => {
        recordTrace?.({
          hook: 'modifyBuildPlan',
          plugin: pluginName,
          phase: 'build-plan',
          operation: 'apply',
          target: plan.id,
        })
        return handler(plan, context)
      })
    },

    modifyRspackRules(handler) {
      hooks.modifyRspackRules.tap(pluginName, async ({ rules, context }) => {
        const start = rules.operations().length
        await handler(rules, context)
        for (const operation of rules.operations().slice(start)) {
          recordTrace?.({
            hook: 'modifyRspackRules',
            plugin: pluginName,
            phase: 'rule',
            operation: operation.operation,
            target: operation.target,
          })
        }
      })
    },

    modifyRspackPlugins(handler) {
      hooks.modifyRspackPlugins.tap(
        pluginName,
        async ({ plugins, context }) => {
          const start = plugins.operations().length
          await handler(plugins, context)
          for (const operation of plugins.operations().slice(start)) {
            recordTrace?.({
              hook: 'modifyRspackPlugins',
              plugin: pluginName,
              phase: 'plugin',
              operation: operation.operation,
              target: operation.target,
            })
          }
        },
      )
    },

    onBeforeCreateCompiler(handler) {
      hooks.onBeforeCreateCompiler.tap(pluginName, handler)
    },

    onBeforeBuild(handler) {
      hooks.onBeforeBuild.tap(pluginName, handler)
    },

    onAfterBuild(handler) {
      hooks.onAfterBuild.tap(pluginName, handler)
    },

    onCloseBuild(handler) {
      hooks.onCloseBuild.tap(pluginName, handler)
    },

    onBeforeStartDevServer(handler) {
      hooks.onBeforeStartDevServer.tap(pluginName, handler)
    },

    onAfterStartDevServer(handler) {
      hooks.onAfterStartDevServer.tap(pluginName, handler)
    },

    onCloseDevServer(handler) {
      hooks.onCloseDevServer.tap(pluginName, handler)
    },

    getIkarosConfig,
    getNormalizedConfig,
  }
}
