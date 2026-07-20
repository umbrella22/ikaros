import type {
  AdapterCapability,
  BuildPlan,
  BuildPlanOutput,
} from './types'

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
