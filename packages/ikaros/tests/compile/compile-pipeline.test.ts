import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CompileContext } from '../../src/node/compile/compile-context'
import type { IkarosPluginAPI } from '../../src/node/core/plugin-api'
import type { NormalizedConfig } from '../../src/node/config/normalize-config'
import type {
  IkarosPlugin,
  UserConfig,
} from '../../src/node/config/user-config'

const mocked = vi.hoisted(() => {
  const compileSpy = vi.fn(async () => undefined)
  const resolvePreConfigSpy = vi.fn()
  const createPlatformAdapterSpy = vi.fn(() => ({
    name: 'web' as const,
    resolvePreConfig: resolvePreConfigSpy,
    compile: compileSpy,
  }))
  const createBundlerAdapterSpy = vi.fn(() => ({
    name: 'rspack' as const,
    createConfig: vi.fn(),
    runDev: vi.fn(),
    runBuild: vi.fn(),
  }))
  const createCompileContextSpy = vi.fn()
  const createBuiltinPluginsSpy = vi.fn(() => [])

  return {
    compileSpy,
    resolvePreConfigSpy,
    createPlatformAdapterSpy,
    createBundlerAdapterSpy,
    createCompileContextSpy,
    createBuiltinPluginsSpy,
  }
})

vi.mock('../../src/node/compile/compile-context', () => ({
  createCompileContext: mocked.createCompileContextSpy,
}))

vi.mock('../../src/node/platform/platform-factory', () => ({
  createPlatformAdapter: mocked.createPlatformAdapterSpy,
}))

vi.mock('../../src/node/bundler/bundler-factory', () => ({
  createBundlerAdapter: mocked.createBundlerAdapterSpy,
}))

vi.mock('../../src/node/core/builtin-plugins', () => ({
  createBuiltinPlugins: mocked.createBuiltinPluginsSpy,
}))

import { runCompile } from '../../src/node/compile/compile-pipeline'

function createNormalizedConfig(
  overrides?: Partial<NormalizedConfig>,
): NormalizedConfig {
  const base: NormalizedConfig = {
    bundler: 'rspack',
    plugins: [],
    quiet: false,
    target: 'pc',
    pages: {
      index: {
        html: '/test/project/index.html',
        entry: '/test/project/src/index.ts',
      },
    },
    enablePages: false,
    define: {},
    rspack: {
      plugins: [],
      loaders: [],
      experiments: { import: [] },
      moduleFederation: [],
      cdnOptions: { modules: [] },
      css: {},
    },
    vite: {
      plugins: [],
    },
    server: {
      port: 3000,
      proxy: undefined,
      https: false,
    },
    build: {
      base: '/',
      assetsDir: '',
      gzip: false,
      sourceMap: false,
      outDirName: 'dist',
      outReport: false,
      cache: false,
      dependencyCycleCheck: false,
    },
    resolve: {
      alias: {
        '@': '/test/project/src',
      },
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
    },
    library: null,
    electron: {},
    base: '/',
    port: 3000,
    browserslist: 'defaults',
    isVue: false,
    isReact: false,
    isElectron: false,
  }

  return {
    ...base,
    ...overrides,
    build: {
      ...base.build,
      ...(overrides?.build ?? {}),
    },
  }
}

function createCompileContext(userConfig?: UserConfig): CompileContext {
  return {
    context: '/test/project',
    command: 'build' as CompileContext['command'],
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
  })

  it('应在平台 resolvePreConfig 前后执行插件配置 hooks', async () => {
    const plugin: IkarosPlugin = {
      name: 'demo-plugin',
      setup(api: IkarosPluginAPI) {
        api.modifyIkarosConfig((config) => ({
          ...config,
          quiet: true,
          define: {
            ...(config?.define ?? {}),
            __FROM_PLUGIN__: 'yes',
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
        bundler: 'rspack',
        plugins: [plugin],
      }),
    )

    mocked.resolvePreConfigSpy.mockImplementation(
      async (ctx: CompileContext) => {
        expect(
          (ctx.userConfig?.define as Record<string, unknown>).__FROM_PLUGIN__,
        ).toBe('yes')
        expect(ctx.userConfig?.quiet).toBe(true)

        return createNormalizedConfig({
          define: ctx.userConfig?.define ?? {},
          quiet: ctx.userConfig?.quiet ?? false,
        })
      },
    )

    await runCompile({
      command: 'build' as never,
      options: {
        platform: 'web',
      },
    })

    expect(mocked.createBundlerAdapterSpy).toHaveBeenCalledWith(
      expect.objectContaining({ bundler: 'rspack' }),
    )
    expect(mocked.compileSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        preConfig: expect.objectContaining({
          quiet: true,
          base: '/plugin-base/',
        }),
        pluginManager: expect.anything(),
      }),
    )
  })
})
