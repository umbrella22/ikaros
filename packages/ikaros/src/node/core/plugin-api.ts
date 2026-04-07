import type { CompileContext } from '../compile/compile-context'
import type { NormalizedConfig } from '../config/normalize-config'
import type { UserConfig } from '../config/user-config'
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
    unknown,
    ModifyBundlerConfigContext<unknown>
  >
  readonly modifyViteConfig: AsyncWaterfallHook<
    unknown,
    ModifyBundlerConfigContext<unknown>
  >
  readonly onBeforeCreateCompiler: AsyncHook<IkarosLifecycleContext>
  readonly onBeforeBuild: AsyncHook<IkarosLifecycleContext>
  readonly onAfterBuild: AsyncHook<IkarosAfterBuildContext>
  readonly onCloseBuild: AsyncHook<IkarosLifecycleContext>
  readonly onBeforeStartDevServer: AsyncHook<IkarosLifecycleContext>
  readonly onAfterStartDevServer: AsyncHook<IkarosLifecycleContext>
  readonly onCloseDevServer: AsyncHook<IkarosLifecycleContext>
}

export interface IkarosPluginAPI {
  readonly context: string
  readonly command: CompileContext['command']
  readonly platform: CompileContext['options']['platform']
  modifyIkarosConfig: (handler: ModifyIkarosConfigHandler) => void
  modifyNormalizedConfig: (handler: ModifyNormalizedConfigHandler) => void
  modifyRspackConfig: <TConfig = unknown>(
    handler: ModifyBundlerConfigHandler<TConfig>,
  ) => void
  modifyViteConfig: <TConfig = unknown>(
    handler: ModifyBundlerConfigHandler<TConfig>,
  ) => void
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
}): IkarosPluginAPI {
  const {
    pluginName,
    compileContext,
    hooks,
    getIkarosConfig,
    getNormalizedConfig,
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
      hooks.modifyRspackConfig.tap(
        pluginName,
        handler as ModifyBundlerConfigHandler<unknown>,
      )
    },

    modifyViteConfig(handler) {
      hooks.modifyViteConfig.tap(
        pluginName,
        handler as ModifyBundlerConfigHandler<unknown>,
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
