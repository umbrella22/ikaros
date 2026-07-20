import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CompileContext } from '../../src/node/compile/compile-context'
import type { IkarosPluginAPI } from '../../src/node/core/plugin-api'
import type {
  IkarosPlugin,
  UserConfig,
} from '../../src/node/config/user-config'

const mocked = vi.hoisted(() => {
  const runSpy = vi.fn(async () => undefined)
  const createPlansSpy = vi.fn(async ({ config }) => [
    {
      id: 'web',
      command: 'build',
      platform: 'web',
      target: 'web',
      bundler: config.bundler,
      mode: undefined,
      context: '/test/project',
      env: {},
      entries: {},
      source: {
        define: config.define,
        alias: config.resolve.alias,
        extensions: config.resolve.extensions,
        framework: 'none',
        browserslist: config.browserslist,
      },
      dev: {
        port: config.port,
        proxy: config.server.proxy,
        https: config.server.https,
        pages: config.enablePages,
      },
      output: {
        base: config.base,
        dir: config.build.outDirName,
        assetsDir: config.build.assetsDir,
        gzip: config.build.gzip,
        sourceMap: config.build.sourceMap,
        report: config.build.outReport,
        cache: config.build.cache,
          checkCycles: config.build.dependencyCycleCheck,
      },
      contextPkg: {
        name: 'test-app',
        version: '1.0.0',
      },
      adapterOptions: {},
      capabilities: [],
      provenance: [],
      diagnostics: [],
    },
  ])
  const createPlatformAdapterSpy = vi.fn(() => ({
    name: 'web' as const,
    createPlans: createPlansSpy,
    run: runSpy,
  }))
  const createCompileContextSpy = vi.fn()
  const createBuiltinPluginsSpy = vi.fn(() => [])

  return {
    runSpy,
    createPlansSpy,
    createPlatformAdapterSpy,
    createCompileContextSpy,
    createBuiltinPluginsSpy,
  }
})

vi.mock('../../src/node/compile/compile-context', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../src/node/compile/compile-context')
    >()

  return {
    ...actual,
    createCompileContext: mocked.createCompileContextSpy,
  }
})

vi.mock('../../src/node/platform/platform-factory', () => ({
  createPlatformAdapter: mocked.createPlatformAdapterSpy,
}))

vi.mock('../../src/node/core/builtin-plugins', () => ({
  createBuiltinPlugins: mocked.createBuiltinPluginsSpy,
}))

import { runCompile } from '../../src/node/compile/compile-pipeline'

function createCompileContext(
  userConfig?: UserConfig,
  command: CompileContext['command'] = 'build' as CompileContext['command'],
): CompileContext {
  return {
    context: '/test/project',
    command,
    options: {
      platform: 'web',
    },
    env: {},
    userConfig,
    contextPkg: {
      name: 'test-app',
      version: '1.0.0',
    },
    resolveContext: (...paths: string[]) =>
      ['/test/project', ...paths].join('/'),
    loadContextModule: vi.fn(),
    resolveContextModule: vi.fn(),
    contextRequire: {} as NodeRequire,
    isElectron: false,
    configFile: undefined,
    onBuildStatus: undefined,
    registerCleanup: undefined,
    preWarnings: [],
    envInfo: {
      filePaths: [],
      loadedFiles: [],
      keySources: {},
    },
    envCleanup: vi.fn(),
  }
}

describe('runCompile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocked.createPlansSpy.mockImplementation(async ({ compileContext: ctx, config }) => [
      {
        id: 'web',
        command: ctx.command,
        platform: 'web',
        target: 'web',
        bundler: config.bundler,
        mode: ctx.options.mode,
        context: ctx.context,
        contextPkg: ctx.contextPkg,
        env: ctx.env,
        entries: {},
        source: {
          define: config.define,
          alias: config.resolve.alias,
          extensions: config.resolve.extensions,
          framework: 'none',
          browserslist: config.browserslist,
        },
        dev: {
          port: config.port,
          proxy: config.server.proxy,
          https: config.server.https,
          pages: config.enablePages,
        },
        output: {
          base: config.base,
          dir: config.build.outDirName,
          assetsDir: config.build.assetsDir,
          gzip: config.build.gzip,
          sourceMap: config.build.sourceMap,
          report: config.build.outReport,
          cache: config.build.cache,
          checkCycles: config.build.dependencyCycleCheck,
        },
        adapterOptions: {},
        capabilities: [],
        provenance: [],
        diagnostics: [],
      },
    ])
  })

  it('应在平台 resolvePreConfig 前后执行插件配置 hooks', async () => {
    const plugin: IkarosPlugin = {
      name: 'demo-plugin',
      setup(api: IkarosPluginAPI) {
        api.modifyIkarosConfig((config) => ({
          ...config,
          log: {
            level: 'quiet',
          },
          source: {
            ...(config?.source ?? {}),
            define: {
              ...(config?.source?.define ?? {}),
              __FROM_PLUGIN__: 'yes',
            },
          },
        }))

        api.modifyNormalizedConfig((config) => ({
          ...config,
          quiet: true,
          build: {
            ...config.build,
            base: '/plugin-base/',
          },
          base: '/plugin-base/',
        }))
      },
    }

    mocked.createCompileContextSpy.mockResolvedValue(
      createCompileContext({
        bundle: {
          adapter: 'rspack',
        },
        plugins: [plugin],
      }),
    )

    mocked.createPlansSpy.mockImplementation(
      async ({ compileContext: ctx, config }) => {
        expect(
          (ctx.userConfig?.source?.define as Record<string, unknown>)
            .__FROM_PLUGIN__,
        ).toBe('yes')
        expect(ctx.userConfig?.log?.level).toBe('quiet')

        return [
          {
            id: 'web',
            command: ctx.command,
            platform: 'web',
            target: 'web',
            bundler: config.bundler,
              mode: ctx.options.mode,
              context: ctx.context,
              contextPkg: ctx.contextPkg,
              env: ctx.env,
            entries: {},
            source: {
              define: config.define,
              alias: config.resolve.alias,
              extensions: config.resolve.extensions,
              framework: 'none',
              browserslist: config.browserslist,
            },
            dev: {
              port: config.port,
              proxy: config.server.proxy,
              https: config.server.https,
              pages: config.enablePages,
            },
            output: {
              base: config.base,
              dir: config.build.outDirName,
              assetsDir: config.build.assetsDir,
              gzip: config.build.gzip,
              sourceMap: config.build.sourceMap,
              report: config.build.outReport,
              cache: config.build.cache,
              checkCycles: config.build.dependencyCycleCheck,
          },
          adapterOptions: {},
          capabilities: [],
          provenance: [],
            diagnostics: [],
          },
        ]
      },
    )

    await runCompile({
      command: 'build' as never,
      options: {
        platform: 'web',
      },
    })

    expect(mocked.runSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        plans: expect.arrayContaining([
          expect.objectContaining({
            output: expect.objectContaining({
              base: '/plugin-base/',
            }),
          }),
        ]),
        pluginManager: expect.anything(),
      }),
    )
  })

  it('build 编译结束后应清理本轮 env', async () => {
    const ctx = createCompileContext()
    mocked.createCompileContextSpy.mockResolvedValue(ctx)

    await runCompile({
      command: 'build' as never,
      options: {
        platform: 'web',
      },
    })

    expect(ctx.envCleanup).toHaveBeenCalledTimes(1)
  })

  it('server 编译应把 env 清理交给运行时 cleanup', async () => {
    const ctx = createCompileContext(undefined, 'server' as never)
    mocked.createCompileContextSpy.mockResolvedValue(ctx)

    await runCompile({
      command: 'server' as never,
      options: {
        platform: 'web',
      },
    })

    expect(ctx.envCleanup).not.toHaveBeenCalled()
  })

  it('modifyIkarosConfig 注入的插件应参与后续配置阶段', async () => {
    const injectedPlugin: IkarosPlugin = {
      name: 'injected-plugin',
      setup(api: IkarosPluginAPI) {
        api.modifyNormalizedConfig((config) => ({
          ...config,
          quiet: true,
        }))
      },
    }
    const plugin: IkarosPlugin = {
      name: 'config-plugin',
      setup(api: IkarosPluginAPI) {
        api.modifyIkarosConfig((config) => ({
          ...config,
          plugins: [...(config?.plugins ?? []), injectedPlugin],
        }))
      },
    }

    mocked.createCompileContextSpy.mockResolvedValue(
      createCompileContext({
        plugins: [plugin],
      }),
    )
    await runCompile({
      command: 'build' as never,
      options: {
        platform: 'web',
      },
    })

    expect(mocked.runSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        plans: expect.any(Array),
      }),
    )
  })
})
