import { isAbsolute, resolve } from 'node:path'

import fse from 'fs-extra'

import {
  applyAdapterCapabilities,
  createBuildPlanExecutor,
  type BuildPlan,
} from '../build-plan'
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
import type { PluginTraceEntry } from '../core/plugin-manager'
import type { IkarosPluginHooks } from '../core/plugin-api'
import { resolveConfigPath } from '../config/config-loader'
import {
  explainNormalizedConfig,
  type NormalizeConfigDiagnostics,
} from '../config/normalize-config'
import { createPlatformAdapter } from '../platform/platform-factory'
import { resolveWebPreConfig } from '../compile/web/resolve-web-preconfig'
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

export type InspectEnvDiagnostics = CompileEnvInfo
export type InspectWatchDiagnostics = WatchdogWatchPlan

export type InspectResolutionDiagnostics = NormalizeConfigDiagnostics

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
  buildPlans: SerializedInspectValue
  bundlerConfigs: SerializedInspectValue
  bundlerConfig: SerializedInspectValue
  diagnostics: {
    bundler: BundlerAdapter['name'] | 'mixed'
    frameworkPlugins: string[]
    hooks: InspectHookDiagnostics
    bundlerPluginNames: string[]
    planBundlers: Record<string, BundlerAdapter['name']>
    planBundlerPluginNames: Record<string, string[]>
    planCapabilities: SerializedInspectValue
    planProvenance: SerializedInspectValue
    planDiagnostics: SerializedInspectValue
    pluginTraces: PluginTraceEntry[]
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

function getPrimaryBundlerName(plans: BuildPlan[]): BundlerAdapter['name'] | 'mixed' {
  const names = new Set(plans.map((plan) => plan.bundler))
  if (names.size === 1) {
    return plans[0]?.bundler ?? 'rspack'
  }

  return 'mixed'
}

function collectAdapterConfigFiles(plans: BuildPlan[]): string[] {
  return [
    ...new Set(
      plans.flatMap((plan) => {
        const configFile = plan.adapterOptions.vite?.configFile
        return plan.bundler === 'vite' && configFile ? [configFile] : []
      }),
    ),
  ]
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
      builtinPlugins: createBuiltinPlugins(compileContext),
      plugins: compileContext.userConfig?.plugins ?? [],
    })
    await pluginManager.init()

    const currentUserConfig = await pluginManager.applyIkarosConfig(
      compileContext.userConfig,
    )
    await pluginManager.addPlugins(currentUserConfig?.plugins ?? [])
    const currentConfig = serializeConfig(currentUserConfig)

    const platform = createPlatformAdapter(compileContext.options.platform, {
      context: compileContext.context,
    })
    const resolvedCompileContext = {
      ...compileContext,
      userConfig: currentUserConfig,
    }
    const baseNormalizedConfig = await resolveWebPreConfig({
      command,
      context: compileContext.context,
      resolveContext: compileContext.resolveContext,
      getUserConfig: async () => currentUserConfig,
      isElectron: platform.name === 'desktopClient',
    })
    const normalizedConfig =
      await pluginManager.applyNormalizedConfig(baseNormalizedConfig)

    const basePlans = await platform.createPlans({
      command,
      compileContext: resolvedCompileContext,
      config: normalizedConfig,
    })
    const plans = applyAdapterCapabilities(
      await pluginManager.applyBuildPlans(basePlans),
    )
    const watchDiagnostics = await resolveWatchdogWatchPlan({
      context: compileContext.context,
      configFile: compileContext.configFile,
      mode: compileContext.options.mode,
      additionalConfigFiles: collectAdapterConfigFiles(plans),
    })
    const executor = createBuildPlanExecutor({
      compileContext: resolvedCompileContext,
      pluginManager,
    })

    const planBundlerConfigs: Record<string, unknown> = {}
    for (const plan of plans) {
      planBundlerConfigs[plan.id] = await executor.createConfig(plan)
    }

    const firstBundlerConfig = plans[0]
      ? planBundlerConfigs[plans[0].id]
      : undefined
    const planBundlerPluginNames = Object.fromEntries(
      Object.entries(planBundlerConfigs).map(([id, config]) => [
        id,
        collectBundlerPluginNames(config),
      ]),
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
      buildPlans: serializeConfig(plans),
      bundlerConfigs: serializeConfig(planBundlerConfigs),
      bundlerConfig: serializeConfig(firstBundlerConfig),
      diagnostics: {
        bundler: getPrimaryBundlerName(plans),
        frameworkPlugins: pluginManager.getPluginNames(),
        hooks: pluginManager.getHookTapNames(),
        bundlerPluginNames: collectBundlerPluginNames(firstBundlerConfig),
        planBundlers: Object.fromEntries(
          plans.map((plan) => [plan.id, plan.bundler]),
        ),
        planBundlerPluginNames,
        planCapabilities: serializeConfig(
          Object.fromEntries(
            plans.map((plan) => [plan.id, plan.capabilities]),
          ),
        ),
        planProvenance: serializeConfig(
          Object.fromEntries(
            plans.map((plan) => [plan.id, plan.provenance]),
          ),
        ),
        planDiagnostics: serializeConfig(
          Object.fromEntries(
            plans.map((plan) => [plan.id, plan.diagnostics]),
          ),
        ),
        pluginTraces: pluginManager.getPluginTraces(),
        resolution: explainNormalizedConfig({
          command,
          userConfig: currentUserConfig,
          sourceUserConfig: compileContext.userConfig,
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
