import { isAbsolute, resolve } from 'node:path'

import fse from 'fs-extra'

import { createBundlerAdapter } from '../bundler/bundler-factory'
import type { BundlerAdapter } from '../bundler/types'
import {
  Command,
  createCompileContext,
  type CompileEnvInfo,
  type CompileContext,
  type CompileOptions,
} from '../compile/compile-context'
import { createBuiltinPlugins } from '../core/builtin-plugins'
import { createPluginManager } from '../core/plugin-manager'
import type { IkarosPluginHooks } from '../core/plugin-api'
import { resolveConfigPath } from '../config/config-loader'
import {
  explainNormalizedConfig,
  type NormalizeConfigDiagnostics,
} from '../config/normalize-config'
import { createPlatformAdapter } from '../platform/platform-factory'
import {
  resolveWatchdogWatchPlan,
  type WatchdogWatchPlan,
} from '../watchdog/watchdog'
import {
  serializeConfig,
  type SerializedInspectValue,
} from './serialize-config'

export type InspectHookDiagnostics = {
  [K in keyof IkarosPluginHooks]: string[]
}

export interface InspectEnvDiagnostics extends CompileEnvInfo {}
export interface InspectWatchDiagnostics extends WatchdogWatchPlan {}

export interface InspectResolutionDiagnostics extends NormalizeConfigDiagnostics {}

export interface InspectConfigParams {
  options: CompileOptions
  command?: Command
  configFile?: string
  context?: string
  writeToDisk?: boolean
  outputFile?: string
}

export interface InspectConfigResult {
  command: Command
  context: string
  platform: CompileOptions['platform']
  mode?: string
  resolvedConfigPath?: string
  env: SerializedInspectValue
  preWarnings: SerializedInspectValue
  rawConfig: SerializedInspectValue
  currentConfig: SerializedInspectValue
  normalizedConfig: SerializedInspectValue
  bundlerConfig: SerializedInspectValue
  diagnostics: {
    bundler: BundlerAdapter['name']
    frameworkPlugins: string[]
    hooks: InspectHookDiagnostics
    bundlerPluginNames: string[]
    resolution: InspectResolutionDiagnostics
    env: InspectEnvDiagnostics
    watch: InspectWatchDiagnostics
  }
  outputFile?: string
}

function createEnvDiagnostics(
  compileContext: CompileContext,
): InspectEnvDiagnostics {
  return (
    compileContext.envInfo ?? {
      filePaths: [],
      loadedFiles: [],
      keySources: {},
    }
  )
}

function readPluginName(plugin: unknown): string | undefined {
  if (
    plugin &&
    typeof plugin === 'object' &&
    'name' in plugin &&
    typeof plugin.name === 'string'
  ) {
    return plugin.name
  }

  if (
    plugin &&
    typeof plugin === 'object' &&
    'constructor' in plugin &&
    plugin.constructor &&
    typeof plugin.constructor === 'function'
  ) {
    return plugin.constructor.name
  }

  return undefined
}

function collectBundlerPluginNames(config: unknown): string[] {
  const names: string[] = []

  const collect = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const item of value) {
        collect(item)
      }
      return
    }

    if (!value || typeof value !== 'object') {
      return
    }

    if ('plugins' in value && Array.isArray(value.plugins)) {
      for (const plugin of value.plugins) {
        const name = readPluginName(plugin)
        if (name) {
          names.push(name)
        }
      }
    }
  }

  collect(config)
  return names
}

function resolveInspectOutputFile(params: {
  context: string
  outputFile?: string
}): string {
  const { context, outputFile } = params

  if (!outputFile) {
    return resolve(context, 'ikaros.inspect.json')
  }

  return isAbsolute(outputFile) ? outputFile : resolve(context, outputFile)
}

export async function inspectConfig(
  params: InspectConfigParams,
): Promise<InspectConfigResult> {
  const command = params.command ?? Command.BUILD
  let compileContext: CompileContext | undefined

  try {
    compileContext = await createCompileContext({
      command,
      options: params.options,
      configFile: params.configFile,
      context: params.context,
    })

    const rawConfig = serializeConfig(compileContext.userConfig)
    const pluginManager = createPluginManager({
      compileContext,
      plugins: [
        ...createBuiltinPlugins(compileContext),
        ...(compileContext.userConfig?.plugins ?? []),
      ],
    })
    await pluginManager.init()

    compileContext.userConfig = await pluginManager.applyIkarosConfig(
      compileContext.userConfig,
    )
    const currentConfig = serializeConfig(compileContext.userConfig)

    const platform = createPlatformAdapter(compileContext.options.platform, {
      context: compileContext.context,
    })
    const watchDiagnostics = await resolveWatchdogWatchPlan({
      context: compileContext.context,
      configFile: compileContext.configFile,
      mode: compileContext.options.mode,
    })
    const baseNormalizedConfig = await platform.resolvePreConfig(compileContext)
    const normalizedConfig =
      await pluginManager.applyNormalizedConfig(baseNormalizedConfig)

    const bundler = createBundlerAdapter({
      bundler: normalizedConfig.bundler,
      loadContextModule: compileContext.loadContextModule,
      resolveContextModule: compileContext.resolveContextModule,
    })

    const bundlerConfig = await pluginManager.applyBundlerConfig(
      bundler.name,
      await bundler.createConfig({
        command,
        mode: compileContext.options.mode,
        env: compileContext.env,
        context: compileContext.context,
        contextPkg: compileContext.contextPkg,
        config: normalizedConfig,
        resolveContext: compileContext.resolveContext,
        preWarnings: compileContext.preWarnings,
      }),
    )

    const result: InspectConfigResult = {
      command,
      context: compileContext.context,
      platform: compileContext.options.platform,
      mode: compileContext.options.mode,
      resolvedConfigPath: await resolveConfigPath({
        configFile: compileContext.configFile,
        context: compileContext.context,
      }),
      env: serializeConfig(compileContext.env),
      preWarnings: serializeConfig(compileContext.preWarnings),
      rawConfig,
      currentConfig,
      normalizedConfig: serializeConfig(normalizedConfig),
      bundlerConfig: serializeConfig(bundlerConfig),
      diagnostics: {
        bundler: bundler.name,
        frameworkPlugins: pluginManager.getPluginNames(),
        hooks: pluginManager.getHookTapNames(),
        bundlerPluginNames: collectBundlerPluginNames(bundlerConfig),
        resolution: explainNormalizedConfig({
          command,
          userConfig: compileContext.userConfig,
          normalizedConfig,
          baseNormalizedConfig,
        }),
        env: createEnvDiagnostics(compileContext),
        watch: watchDiagnostics,
      },
    }

    if (params.writeToDisk) {
      const outputFile = resolveInspectOutputFile({
        context: compileContext.context,
        outputFile: params.outputFile,
      })
      result.outputFile = outputFile
      await fse.outputFile(outputFile, JSON.stringify(result, null, 2))
    }

    return result
  } finally {
    compileContext?.envCleanup()
  }
}
