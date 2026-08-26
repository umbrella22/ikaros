import type { BuildPlan, BuildTargetKind } from './types'

export type BuildPlanValidationEntry =
  | 'platform.createPlans'
  | 'plugin.modifyBuildPlans'
  | 'plugin.modifyBuildPlan'
  | 'executor.createConfig'
  | 'executor.runDev'
  | 'executor.runBuild'
  | 'executor.watchBuild'

export class BuildPlanShapeError extends Error {
  readonly code = 'BUILD_PLAN_INVALID'
  readonly entry: BuildPlanValidationEntry
  readonly violations: string[]

  constructor(init: { entry: BuildPlanValidationEntry; violations: string[] }) {
    super(
      `[ikaros] ${init.entry} received an invalid BuildPlan: ${init.violations.join('; ')}`,
    )
    this.name = 'BuildPlanShapeError'
    this.entry = init.entry
    this.violations = init.violations
  }
}

const BUILD_TARGETS = new Set<BuildTargetKind>([
  'web',
  'electron-main',
  'electron-preload',
  'electron-renderer',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function collectBuildPlanShapeViolations(value: unknown): string[] {
  if (!isRecord(value)) {
    return ['plan must be a non-null object']
  }

  const violations: string[] = []
  const target = value.target

  if (typeof value.id !== 'string' || value.id.length === 0) {
    violations.push('id must be a non-empty string')
  }
  if (value.command !== 'build' && value.command !== 'server') {
    violations.push("command must be 'build' or 'server'")
  }
  if (value.platform !== 'web' && value.platform !== 'desktopClient') {
    violations.push("platform must be 'web' or 'desktopClient'")
  }
  if (
    typeof target !== 'string' ||
    !BUILD_TARGETS.has(target as BuildTargetKind)
  ) {
    violations.push('target is not a supported BuildTargetKind')
  }
  if (value.bundler !== 'rspack' && value.bundler !== 'vite') {
    violations.push("bundler must be 'rspack' or 'vite'")
  }
  if (typeof value.context !== 'string' || value.context.length === 0) {
    violations.push('context must be a non-empty string')
  }

  for (const field of [
    'env',
    'entries',
    'source',
    'dev',
    'output',
    'adapterOptions',
  ]) {
    if (!isRecord(value[field])) {
      violations.push(`${field} must be an object`)
    }
  }

  for (const field of ['capabilities', 'provenance', 'diagnostics']) {
    const items = value[field]
    if (!Array.isArray(items)) {
      violations.push(`${field} must be an array`)
      continue
    }
    if (items.some((item) => !isRecord(item))) {
      violations.push(`${field} entries must be non-null objects`)
    }
  }

  if (value.contextPkg !== undefined && !isRecord(value.contextPkg)) {
    violations.push('contextPkg must be an object when provided')
  }

  if (value.platform === 'web' && target !== 'web') {
    violations.push("web platform requires target 'web'")
  }
  if (value.platform === 'desktopClient' && target === 'web') {
    violations.push('desktopClient platform requires an electron target')
  }
  if (
    (target === 'electron-main' || target === 'electron-preload') &&
    value.bundler !== 'rspack'
  ) {
    violations.push(`${target} requires the rspack bundler`)
  }

  return violations
}

export function assertBuildPlanShape(
  plan: unknown,
  entry: BuildPlanValidationEntry,
): asserts plan is BuildPlan {
  const violations = collectBuildPlanShapeViolations(plan)
  if (violations.length > 0) {
    throw new BuildPlanShapeError({ entry, violations })
  }
}

export function assertBuildPlansShape(
  plans: unknown,
  entry: Extract<
    BuildPlanValidationEntry,
    'platform.createPlans' | 'plugin.modifyBuildPlans'
  >,
): asserts plans is BuildPlan[] {
  if (!Array.isArray(plans)) {
    throw new BuildPlanShapeError({
      entry,
      violations: ['result must be an array'],
    })
  }

  const violations: string[] = []
  const ids = new Set<string>()
  plans.forEach((plan, index) => {
    for (const violation of collectBuildPlanShapeViolations(plan)) {
      violations.push(`[${index}] ${violation}`)
    }
    if (isRecord(plan) && typeof plan.id === 'string' && plan.id.length > 0) {
      if (ids.has(plan.id)) {
        violations.push(`[${index}] duplicate id '${plan.id}'`)
      }
      ids.add(plan.id)
    }
  })

  if (violations.length > 0) {
    throw new BuildPlanShapeError({ entry, violations })
  }
}
