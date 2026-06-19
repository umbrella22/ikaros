import { afterEach, describe, expect, it, vi } from 'vitest'

const runnerMocks = vi.hoisted(() => {
  const runDesktopClientBuild = vi.fn(
    async (params: {
      buildMain: () => Promise<unknown>
      buildPreload: () => Promise<unknown>
      buildRenderer: () => Promise<unknown>
    }) => {
      await params.buildMain()
      await Promise.all([params.buildPreload(), params.buildRenderer()])
    },
  )

  return {
    runDesktopClientDev: vi.fn(async () => undefined),
    runDesktopClientBuild,
  }
})

const fsMocks = vi.hoisted(() => ({
  rm: vi.fn(async () => undefined),
  mkdir: vi.fn(async () => undefined),
  cp: vi.fn(async () => undefined),
  writeFile: vi.fn(async () => undefined),
}))

vi.mock('../src/runner', () => runnerMocks)
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    promises: {
      ...actual.promises,
      rm: fsMocks.rm,
      mkdir: fsMocks.mkdir,
      cp: fsMocks.cp,
      writeFile: fsMocks.writeFile,
    },
  }
})

import { ElectronDesktopPlatform } from '../src/platform/electron-desktop-platform'
import type {
  BuildPlan,
  BuildPlanExecutor,
  CompileContext,
} from '@ikaros-cli/ikaros/adapter'

const createPlan = (
  target: BuildPlan['target'],
  bundler: BuildPlan['bundler'] = 'rspack',
): BuildPlan => ({
  id: target,
  command: 'server',
  platform: 'desktopClient',
  target,
  bundler,
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

describe('ElectronDesktopPlatform', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('dev 模式应透传 electron.build inspectPort 与 electronArgs', async () => {
    const platform = new ElectronDesktopPlatform()
    const plans = [
      createPlan('electron-main'),
      createPlan('electron-preload'),
      createPlan('electron-renderer', 'vite'),
    ]
    const executor: BuildPlanExecutor = {
      createConfig: vi.fn(async (plan: BuildPlan) => {
        if (plan.target === 'electron-main') {
          return {
            target: 'electron-main',
            output: {
              path: '/test/project/dist/electron/main',
              filename: 'main.js',
            },
          }
        }
        if (plan.target === 'electron-preload') {
          return [
            {
              target: 'electron-preload',
              output: {
                path: '/test/project/dist/electron/preload',
                filename: 'preload.js',
              },
            },
          ]
        }
        return {}
      }),
      runDev: vi.fn(),
      runDevConfig: vi.fn(),
      runBuild: vi.fn(),
      runBuildConfig: vi.fn(),
      watchBuild: vi.fn(),
      watchBuildConfig: vi.fn(),
    }

    await platform.run({
      command: 'server',
      plans,
      compileContext: {
        context: '/test/project',
        userConfig: {
          electron: {
            build: {
              debug: true,
              inspectPort: 9333,
              electronArgs: ['--foo', 'bar'],
            },
          },
        },
        contextPkg: {
          name: 'test-app',
          version: '1.0.0',
        },
        resolveContext: (...paths: string[]) =>
          ['/test/project', ...paths].join('/'),
        loadContextModule: vi.fn(),
        registerCleanup: vi.fn(),
      } as unknown as CompileContext,
      pluginManager: {} as never,
      executor,
      logger: {
        info: vi.fn(),
        done: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        okay: vi.fn(),
      },
    })

    expect(runnerMocks.runDesktopClientDev).toHaveBeenCalledWith(
      expect.objectContaining({
        controlledRestart: true,
        inspectPort: 9333,
        electronArgs: ['--foo', 'bar'],
      }),
    )
  })

  it('build hotReload + vite renderer 应复制 renderer 产物到 resources', async () => {
    const platform = new ElectronDesktopPlatform()
    const plans = [
      { ...createPlan('electron-main'), command: 'build' as const },
      { ...createPlan('electron-preload'), command: 'build' as const },
      { ...createPlan('electron-renderer', 'vite'), command: 'build' as const },
    ]
    const executor: BuildPlanExecutor = {
      createConfig: vi.fn(async (plan: BuildPlan) => {
        if (plan.target === 'electron-main') {
          return {
            target: 'electron-main',
            output: {
              path: '/test/project/dist/electron/main',
              filename: 'main.js',
            },
          }
        }
        if (plan.target === 'electron-preload') {
          return [
            {
              target: 'electron-preload',
              output: {
                path: '/test/project/dist/electron/preload',
                filename: 'preload.js',
              },
            },
          ]
        }
        return {
          build: {
            outDir: '/test/project/dist/electron/renderer',
          },
        }
      }),
      runDev: vi.fn(),
      runDevConfig: vi.fn(),
      runBuild: vi.fn(async () => 'renderer built'),
      runBuildConfig: vi.fn(async () => 'main built'),
      watchBuild: vi.fn(),
      watchBuildConfig: vi.fn(),
    }

    await platform.run({
      command: 'build',
      plans,
      compileContext: {
        context: '/test/project',
        userConfig: {
          electron: {
            build: {
              hotReload: true,
            },
          },
        },
        contextPkg: {
          name: 'test-app',
          version: '1.0.0',
        },
        resolveContext: (...paths: string[]) =>
          ['/test/project', ...paths].join('/'),
        loadContextModule: vi.fn(),
        registerCleanup: vi.fn(),
      } as unknown as CompileContext,
      pluginManager: {} as never,
      executor,
      logger: {
        info: vi.fn(),
        done: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        okay: vi.fn(),
      },
    })

    expect(fsMocks.cp).toHaveBeenCalledWith(
      '/test/project/dist/electron/main',
      '/test/project/build/resources/dist/main',
      expect.any(Object),
    )
    expect(fsMocks.cp).toHaveBeenCalledWith(
      '/test/project/dist/electron/preload',
      '/test/project/build/resources/dist/preload',
      expect.any(Object),
    )
    expect(fsMocks.cp).toHaveBeenCalledWith(
      '/test/project/dist/electron/renderer',
      '/test/project/build/resources/dist/renderer',
      expect.any(Object),
    )
  })
})
