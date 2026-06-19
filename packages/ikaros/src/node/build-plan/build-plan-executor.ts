import type {
  BuildPlanExecutor,
  BundlerAdapter,
  PlanBuildOptions,
  PlanDevOptions,
} from '../adapter'
import { createBundlerAdapter } from '../bundler/bundler-factory'
import type { CompileContext } from '../compile/compile-context'
import type { PluginManager } from '../core/plugin-manager'
import type { BuildPlan } from './types'

export interface CreateBuildPlanExecutorParams {
  compileContext: CompileContext
  pluginManager: PluginManager
}

export function createBuildPlanExecutor(
  params: CreateBuildPlanExecutorParams,
): BuildPlanExecutor {
  const adapterCache = new Map<string, BundlerAdapter>()

  const getAdapterByName = (bundler: BuildPlan['bundler']): BundlerAdapter => {
    const cached = adapterCache.get(bundler)
    if (cached) return cached

    const adapter = createBundlerAdapter({
      bundler,
      resolveContextModule: params.compileContext.resolveContextModule,
    })

    adapterCache.set(bundler, adapter)
    return adapter
  }

  const getAdapter = (plan: BuildPlan): BundlerAdapter => {
    const adapter = getAdapterByName(plan.bundler)

    if (!adapter.supports(plan)) {
      throw new Error(
        `[ikaros] bundler ${adapter.name} does not support plan ${plan.id}`,
      )
    }

    return adapter
  }

  const createFinalConfig = async (plan: BuildPlan): Promise<unknown> => {
    const adapter = getAdapter(plan)
    const baseConfig = await adapter.createConfig(plan)
    return params.pluginManager.applyBundlerConfig(adapter.name, baseConfig)
  }

  return {
    createConfig: createFinalConfig,

    async runDev(plan: BuildPlan, options: PlanDevOptions = {}) {
      const adapter = getAdapter(plan)
      const config = await createFinalConfig(plan)
      await adapter.runDev(config, options)
    },

    async runDevConfig(
      bundler: BuildPlan['bundler'],
      config: unknown,
      options: PlanDevOptions = {},
    ) {
      const adapter = getAdapterByName(bundler)
      await adapter.runDev(config, options)
    },

    async runBuild(plan: BuildPlan, options: PlanBuildOptions = {}) {
      const adapter = getAdapter(plan)
      const config = await createFinalConfig(plan)
      return adapter.runBuild(config, options)
    },

    async watchBuild(plan: BuildPlan, options: PlanBuildOptions = {}) {
      const adapter = getAdapter(plan)
      if (!adapter.watchBuild) {
        throw new Error(
          `[ikaros] bundler ${adapter.name} does not support watchBuild`,
        )
      }
      const config = await createFinalConfig(plan)
      await adapter.watchBuild(config, options)
    },

    async runBuildConfig(
      bundler: BuildPlan['bundler'],
      config: unknown,
      options: PlanBuildOptions = {},
    ) {
      const adapter = getAdapterByName(bundler)
      return adapter.runBuild(config, options)
    },

    async watchBuildConfig(
      bundler: BuildPlan['bundler'],
      config: unknown,
      options: PlanBuildOptions = {},
    ) {
      const adapter = getAdapterByName(bundler)
      if (!adapter.watchBuild) {
        throw new Error(
          `[ikaros] bundler ${adapter.name} does not support watchBuild`,
        )
      }
      await adapter.watchBuild(config, options)
    },
  }
}
