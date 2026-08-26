import type { AdapterCapability, BuildPlan, BuildPlanOutput } from './types'
import { assertBuildPlansShape } from './build-plan-shape'

/**
 * platform.createPlans 消费边界守卫——外部/动态加载的 PlatformAdapter
 * 只被校验 createPlans/run 是函数（platform-factory），其产物在此前未
 * 经过任何类型化校验：没有插件 hook 时 applyBuildPlans 原样放行，
 * diagnostics/capabilities/provenance 缺失会在本模块的
 * plan.diagnostics.filter 处触发裸 TypeError。compile 与 inspect 都在
 * applyAdapterCapabilities 之前调用本守卫，违规抛带 platform.createPlans
 * 来源的 BuildPlanShapeError。
 *
 * 接收 unknown 输入，逐步校验顶层类型、数组元素有效性
 * 和嵌套数组元素（如 diagnostics: [null]），确保所有边界异常都是
 * BuildPlanShapeError 而非裸 TypeError。
 */
export function assertBuildPlansFromPlatform(
  plans: unknown,
): asserts plans is BuildPlan[] {
  assertBuildPlansShape(plans, 'platform.createPlans')
}

type CapabilityInput = Pick<BuildPlan, 'bundler' | 'output'>

const RSPACK_CAPABILITIES: AdapterCapability[] = [
  {
    id: 'output.cache',
    status: 'supported',
    message: 'Rspack adapter supports persistent build cache.',
  },
  {
    id: 'output.gzip',
    status: 'supported',
    message: 'Rspack adapter supports gzip asset output.',
  },
  {
    id: 'output.report',
    status: 'supported',
    message: 'Rspack adapter supports build reports.',
  },
  {
    id: 'output.checkCycles',
    status: 'supported',
    message: 'Rspack adapter supports dependency-cycle checks.',
  },
]

const VITE_CAPABILITIES: AdapterCapability[] = [
  {
    id: 'output.cache',
    status: 'unsupported',
    message:
      'Vite adapter does not map output.cache. Use bundle.vite.config.cacheDir for Vite cache-directory control.',
  },
  {
    id: 'output.gzip',
    status: 'supported',
    message: 'Vite adapter emits gzip assets through ikaros:vite-build.',
  },
  {
    id: 'output.report',
    status: 'supported',
    message: 'Vite adapter emits ikaros-report.json through ikaros:vite-build.',
  },
  {
    id: 'output.checkCycles',
    status: 'supported',
    message: 'Vite adapter checks dependency cycles through ikaros:vite-build.',
  },
]

export function getAdapterCapabilities(
  input: Pick<CapabilityInput, 'bundler'>,
): AdapterCapability[] {
  const capabilities =
    input.bundler === 'vite' ? VITE_CAPABILITIES : RSPACK_CAPABILITIES

  return capabilities.map((capability) => ({ ...capability }))
}

function isCapabilityEnabled(
  output: BuildPlanOutput,
  id: AdapterCapability['id'],
): boolean {
  switch (id) {
    case 'output.cache':
      return output.cache
    case 'output.gzip':
      return output.gzip
    case 'output.report':
      return output.report
    case 'output.checkCycles':
      return output.checkCycles
  }
}

/**
 * Recompute after build-plan plugins so inspect and execution report the same
 * adapter constraints even when a plugin changes the plan.
 */
export function applyAdapterCapabilities(plans: BuildPlan[]): BuildPlan[] {
  return plans.map((plan) => {
    const capabilities = getAdapterCapabilities(plan)
    const diagnostics = plan.diagnostics.filter(
      (diagnostic) => diagnostic.source !== 'adapter-capabilities',
    )

    for (const capability of capabilities) {
      if (
        capability.status === 'unsupported' &&
        isCapabilityEnabled(plan.output, capability.id)
      ) {
        diagnostics.push({
          level: 'warning',
          source: 'adapter-capabilities',
          message: `${capability.id} is enabled but unsupported by ${plan.bundler}: ${capability.message}`,
        })
      }
    }

    return {
      ...plan,
      capabilities,
      diagnostics,
    }
  })
}
