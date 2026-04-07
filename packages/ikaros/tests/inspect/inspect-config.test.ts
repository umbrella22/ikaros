import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import type {
  CompileContext,
  CompileEnvInfo,
} from '../../src/node/compile/compile-context'
import type { IkarosPluginAPI } from '../../src/node/core/plugin-api'
import type { NormalizedConfig } from '../../src/node/config/normalize-config'
import type {
  IkarosPlugin,
  UserConfig,
} from '../../src/node/config/user-config'

const mocked = vi.hoisted(() => {
  const createCompileContextSpy = vi.fn()
  const resolveConfigPathSpy = vi.fn()
  const resolvePreConfigSpy = vi.fn()
  const createPlatformAdapterSpy = vi.fn(() => ({
    name: 'web' as const,
    resolvePreConfig: resolvePreConfigSpy,
    compile: vi.fn(),
  }))
  const createBundlerAdapterSpy = vi.fn(() => ({
    name: 'rspack' as const,
    createConfig: vi.fn(() => ({
      entry: 'index',
      plugins: [{ name: 'bundler-plugin' }],
      matcher: /demo/,
      transform() {},
    })),
    runDev: vi.fn(),
    runBuild: vi.fn(),
  }))
  const createBuiltinPluginsSpy = vi.fn()
  const resolveWatchdogWatchPlanSpy = vi.fn()

  return {
    createCompileContextSpy,
    resolveConfigPathSpy,
    resolvePreConfigSpy,
    createPlatformAdapterSpy,
    createBundlerAdapterSpy,
    createBuiltinPluginsSpy,
    resolveWatchdogWatchPlanSpy,
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

vi.mock('../../src/node/config/config-loader', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../src/node/config/config-loader')>()

  return {
    ...actual,
    resolveConfigPath: mocked.resolveConfigPathSpy,
  }
})

vi.mock('../../src/node/platform/platform-factory', () => ({
  createPlatformAdapter: mocked.createPlatformAdapterSpy,
}))

vi.mock('../../src/node/bundler/bundler-factory', () => ({
  createBundlerAdapter: mocked.createBundlerAdapterSpy,
}))

vi.mock('../../src/node/core/builtin-plugins', () => ({
  createBuiltinPlugins: mocked.createBuiltinPluginsSpy,
}))

vi.mock('../../src/node/watchdog/watchdog', () => ({
  resolveWatchdogWatchPlan: mocked.resolveWatchdogWatchPlanSpy,
}))

import {
  Command,
  type CompileOptions,
} from '../../src/node/compile/compile-context'
import { inspectConfig } from '../../src/node/inspect/inspect-config'

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

function createCompileContext(params: {
  context: string
  options: CompileOptions
  userConfig?: UserConfig
  envCleanup?: () => void
  envInfo?: CompileEnvInfo
}): CompileContext {
  return {
    context: params.context,
    command: Command.BUILD,
    options: params.options,
    env: {
      MODE: params.options.mode,
      API: 'https://local.example.com',
    },
    userConfig: params.userConfig,
    contextPkg: {
      name: 'demo-app',
      version: '1.0.0',
    },
    resolveContext: (...paths: string[]) =>
      [params.context, ...paths].join('/'),
    loadContextModule: vi.fn(),
    resolveContextModule: vi.fn(),
    contextRequire: {} as NodeRequire,
    isElectron: false,
    configFile: 'ikaros.config.mjs',
    onBuildStatus: undefined,
    registerCleanup: undefined,
    preWarnings: [
      {
        source: 'env-loader',
        message: 'env warning',
      },
    ],
    envInfo: params.envInfo,
    envCleanup: params.envCleanup ?? vi.fn(),
  }
}

describe('inspectConfig', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'ikaros-inspect-test-'))
    vi.clearAllMocks()
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('应输出配置链路、env 来源与 watch 计划诊断', async () => {
    const envCleanup = vi.fn()
    const envInfo: CompileEnvInfo = {
      filePaths: [
        join(tempDir, 'env', '.env'),
        join(tempDir, 'env', '.env.local'),
        join(tempDir, 'env', '.env.production'),
        join(tempDir, 'env', '.env.production.local'),
      ],
      loadedFiles: [
        join(tempDir, 'env', '.env'),
        join(tempDir, 'env', '.env.production.local'),
      ],
      keySources: {
        API: join(tempDir, 'env', '.env.production.local'),
      },
    }

    const userPlugin: IkarosPlugin = {
      name: 'user-plugin',
      setup(api: IkarosPluginAPI) {
        api.modifyIkarosConfig((config) => ({
          ...config,
          quiet: true,
        }))
        api.modifyNormalizedConfig((config) => ({
          ...config,
          base: '/from-plugin/',
          build: {
            ...config.build,
            base: '/from-plugin/',
          },
        }))
        api.modifyRspackConfig((config: Record<string, unknown>) => ({
          ...config,
          fromUserPlugin: true,
        }))
      },
    }

    const builtinPlugin: IkarosPlugin = {
      name: 'builtin-plugin',
      setup(api: IkarosPluginAPI) {
        api.modifyRspackConfig((config: Record<string, unknown>) => ({
          ...config,
          fromBuiltinPlugin: true,
        }))
      },
    }

    mocked.createCompileContextSpy.mockResolvedValue(
      createCompileContext({
        context: tempDir,
        options: {
          mode: 'production',
          platform: 'web',
        },
        userConfig: {
          bundler: 'rspack',
          define: {
            RAW_FLAG: 'yes',
          },
          plugins: [userPlugin],
        },
        envCleanup,
        envInfo,
      }),
    )
    mocked.createBuiltinPluginsSpy.mockReturnValue([builtinPlugin])
    mocked.resolveConfigPathSpy.mockResolvedValue(
      join(tempDir, 'ikaros.config.mjs'),
    )
    mocked.resolvePreConfigSpy.mockImplementation(
      async (ctx: CompileContext) => {
        return createNormalizedConfig({
          quiet: ctx.userConfig?.quiet ?? false,
          define: ctx.userConfig?.define ?? {},
        })
      },
    )
    mocked.resolveWatchdogWatchPlanSpy.mockResolvedValue({
      envDir: join(tempDir, 'env'),
      envFiles: envInfo.filePaths,
      configEntryFiles: [join(tempDir, 'ikaros.config.mjs')],
      configDependencyFiles: [join(tempDir, 'config.shared.ts')],
      trackedFiles: [
        join(tempDir, 'ikaros.config.mjs'),
        ...envInfo.filePaths,
        join(tempDir, 'config.shared.ts'),
      ],
      watchedPaths: [
        join(tempDir, 'ikaros.config.mjs'),
        ...envInfo.filePaths,
        join(tempDir, 'config.shared.ts'),
        join(tempDir, 'env'),
      ],
      fileCategories: {
        [join(tempDir, 'ikaros.config.mjs')]: 'config',
        [join(tempDir, 'config.shared.ts')]: 'config',
        [join(tempDir, 'env', '.env')]: 'env',
        [join(tempDir, 'env', '.env.local')]: 'env',
        [join(tempDir, 'env', '.env.production')]: 'env',
        [join(tempDir, 'env', '.env.production.local')]: 'env',
      },
    })

    const result = await inspectConfig({
      command: Command.BUILD,
      options: {
        mode: 'production',
        platform: 'web',
      },
      context: tempDir,
      writeToDisk: true,
      outputFile: 'artifacts/inspect.json',
    })

    expect(result.rawConfig).toMatchObject({
      bundler: 'rspack',
      define: {
        RAW_FLAG: 'yes',
      },
    })
    expect(result.currentConfig).toMatchObject({
      quiet: true,
    })
    expect(result.normalizedConfig).toMatchObject({
      quiet: true,
      base: '/from-plugin/',
    })
    expect(result.bundlerConfig).toMatchObject({
      entry: 'index',
      fromBuiltinPlugin: true,
      fromUserPlugin: true,
      matcher: '/demo/',
      transform: '[Function transform]',
    })
    expect(result.diagnostics.frameworkPlugins).toEqual([
      'builtin-plugin',
      'user-plugin',
    ])
    expect(result.diagnostics.hooks.modifyIkarosConfig).toEqual(['user-plugin'])
    expect(result.diagnostics.hooks.modifyRspackConfig).toEqual([
      'builtin-plugin',
      'user-plugin',
    ])
    expect(result.diagnostics.bundlerPluginNames).toEqual(['bundler-plugin'])
    expect(result.diagnostics.resolution.target).toMatchObject({
      value: 'pc',
      source: 'default.target',
    })
    expect(result.diagnostics.resolution.browserslist).toMatchObject({
      value: 'defaults',
      source: 'target.pc',
    })
    expect(result.diagnostics.resolution.base).toMatchObject({
      value: '/from-plugin/',
      source: 'plugin.modifyNormalizedConfig',
      overriddenFrom: '/',
      devServerCompatible: true,
      validation: 'skipped',
    })
    expect(result.diagnostics.resolution.port).toMatchObject({
      value: 3000,
      source: 'detect-port',
      requestedPort: 8080,
      autoDetected: true,
    })
    expect(result.diagnostics.resolution.framework.selected).toMatchObject({
      value: 'none',
      source: 'framework.none',
    })
    expect(result.diagnostics.env).toEqual(envInfo)
    expect(result.diagnostics.watch).toMatchObject({
      envDir: join(tempDir, 'env'),
      configDependencyFiles: [join(tempDir, 'config.shared.ts')],
      fileCategories: {
        [join(tempDir, 'config.shared.ts')]: 'config',
        [join(tempDir, 'env', '.env.production.local')]: 'env',
      },
    })
    expect(result.outputFile).toBe(join(tempDir, 'artifacts/inspect.json'))
    expect(result.resolvedConfigPath).toBe(join(tempDir, 'ikaros.config.mjs'))
    expect(mocked.resolveWatchdogWatchPlanSpy).toHaveBeenCalledWith({
      context: tempDir,
      configFile: 'ikaros.config.mjs',
      mode: 'production',
    })

    const written = JSON.parse(readFileSync(result.outputFile, 'utf8'))
    expect(written.outputFile).toBe(join(tempDir, 'artifacts/inspect.json'))
    expect(written.diagnostics.env.keySources.API).toBe(
      join(tempDir, 'env', '.env.production.local'),
    )
    expect(envCleanup).toHaveBeenCalledTimes(1)
  })
})
