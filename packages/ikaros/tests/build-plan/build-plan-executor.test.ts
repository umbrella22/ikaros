import { describe, expect, it, vi } from 'vitest'

const mocked = vi.hoisted(() => {
  const watchBuildSpy = vi.fn(async () => undefined)
  const createConfigSpy = vi.fn(() => ({ entry: 'index' }))
  const adapter = {
    name: 'rspack' as const,
    supports: vi.fn(() => true),
    createConfig: createConfigSpy,
    runDev: vi.fn(),
    runBuild: vi.fn(),
    watchBuild: watchBuildSpy,
  }

  return {
    adapter,
    watchBuildSpy,
  }
})

vi.mock('../../src/node/bundler/bundler-factory', () => ({
  createBundlerAdapter: vi.fn(() => mocked.adapter),
}))

import { createBuildPlanExecutor } from '../../src/node/build-plan'
import type { BuildPlan } from '../../src/node/build-plan'
import type { CompileContext } from '../../src/node/compile/compile-context'
import type { PluginManager } from '../../src/node/core/plugin-manager'

const createPlan = (): BuildPlan => ({
  id: 'web',
  command: 'build',
  platform: 'web',
  target: 'web',
  bundler: 'rspack',
  context: '/test/project',
  env: {},
  entries: {},
  source: {
    define: {},
    alias: {},
    extensions: ['.ts', '.js'],
    framework: 'none',
    browserslist: 'defaults',
  },
  dev: {
    port: 3000,
    https: false,
    pages: false,
  },
  output: {
    base: '/',
    dir: 'dist',
    assetsDir: '',
    gzip: false,
    sourceMap: false,
    report: false,
    cache: false,
    checkCycles: false,
  },
  adapterOptions: {},
  provenance: [],
  diagnostics: [],
})

describe('createBuildPlanExecutor', () => {
  it('watchBuild 应透传 registerCleanup 给 adapter', async () => {
    const registerCleanup = vi.fn()
    const executor = createBuildPlanExecutor({
      compileContext: {
        resolveContextModule: vi.fn(),
      } as unknown as CompileContext,
      pluginManager: {
        applyBundlerConfig: vi.fn(async (_bundler, config) => config),
      } as unknown as PluginManager,
    })

    await executor.watchBuild(createPlan(), {
      registerCleanup,
    })

    expect(mocked.watchBuildSpy).toHaveBeenCalledWith(
      { entry: 'index' },
      { registerCleanup },
    )
  })
})
