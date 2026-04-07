import { describe, expect, it, vi } from 'vitest'

import type { BundlerAdapter } from '../../src/node/bundler/types'
import type { CompileContext } from '../../src/node/compile/compile-context'
import type { IkarosPluginAPI } from '../../src/node/core/plugin-api'
import { createPluginManager } from '../../src/node/core/plugin-manager'
import type { NormalizedConfig } from '../../src/node/config/normalize-config'
import type {
  IkarosPlugin,
  UserConfig,
} from '../../src/node/config/user-config'
import { WebPlatformAdapter } from '../../src/node/platform/web'

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

function createCompileContext(
  userConfig?: UserConfig,
  registerCleanup?: (cleanup: () => Promise<void> | void) => void,
): CompileContext {
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
    registerCleanup,
    preWarnings: [],
    envInfo: {
      filePaths: [],
      loadedFiles: [],
      keySources: {},
    },
    envCleanup: vi.fn(),
  }
}

describe('WebPlatformAdapter plugin hooks', () => {
  it('build 模式应执行 bundler config 与 build 生命周期 hooks', async () => {
    const order: string[] = []
    const plugin: IkarosPlugin = {
      name: 'build-hooks',
      setup(api: IkarosPluginAPI) {
        api.onBeforeCreateCompiler(() => {
          order.push('before-create')
        })
        api.modifyRspackConfig((config: Record<string, unknown>) => {
          order.push('modify-rspack')
          return {
            ...config,
            fromPlugin: true,
          }
        })
        api.onBeforeBuild(() => {
          order.push('before-build')
        })
        api.onAfterBuild(({ result }) => {
          order.push(`after-build:${result}`)
        })
        api.onCloseBuild(() => {
          order.push('close-build')
        })
      },
    }

    const ctx = createCompileContext({ plugins: [plugin] })
    const pluginManager = createPluginManager({
      compileContext: ctx,
      plugins: ctx.userConfig?.plugins,
    })
    await pluginManager.init()
    await pluginManager.applyIkarosConfig(ctx.userConfig)
    const preConfig = await pluginManager.applyNormalizedConfig(
      createNormalizedConfig(),
    )

    let receivedConfig: Record<string, unknown> | undefined
    const bundler: BundlerAdapter<Record<string, unknown>> = {
      name: 'rspack',
      createConfig: () => ({
        entry: 'index',
      }),
      runDev: async () => undefined,
      runBuild: async (config) => {
        receivedConfig = config
        return 'ok'
      },
    }

    const platform = new WebPlatformAdapter()
    await platform.compile(bundler, {
      command: 'build',
      preConfig,
      compileContext: ctx,
      pluginManager,
    })

    expect(receivedConfig).toMatchObject({
      entry: 'index',
      fromPlugin: true,
    })
    expect(order).toEqual([
      'before-create',
      'modify-rspack',
      'before-build',
      'after-build:ok',
      'close-build',
    ])
  })

  it('server 模式应执行 dev 生命周期 hooks 并在 cleanup 时触发关闭 hook', async () => {
    const order: string[] = []
    const cleanups: Array<() => Promise<void> | void> = []

    const plugin: IkarosPlugin = {
      name: 'dev-hooks',
      setup(api: IkarosPluginAPI) {
        api.onBeforeCreateCompiler(() => {
          order.push('before-create')
        })
        api.modifyRspackConfig((config: Record<string, unknown>) => {
          order.push('modify-rspack')
          return {
            ...config,
            devModified: true,
          }
        })
        api.onBeforeStartDevServer(() => {
          order.push('before-dev')
        })
        api.onAfterStartDevServer(() => {
          order.push('after-dev')
        })
        api.onCloseDevServer(() => {
          order.push('close-dev')
        })
      },
    }

    const ctx = createCompileContext({ plugins: [plugin] }, (cleanup) =>
      cleanups.push(cleanup),
    )
    ctx.command = 'server' as CompileContext['command']

    const pluginManager = createPluginManager({
      compileContext: ctx,
      plugins: ctx.userConfig?.plugins,
    })
    await pluginManager.init()
    await pluginManager.applyIkarosConfig(ctx.userConfig)
    const preConfig = await pluginManager.applyNormalizedConfig(
      createNormalizedConfig(),
    )

    let receivedConfig: Record<string, unknown> | undefined
    const bundler: BundlerAdapter<Record<string, unknown>> = {
      name: 'rspack',
      createConfig: () => ({
        entry: 'index',
      }),
      runDev: async (config) => {
        receivedConfig = config
      },
      runBuild: async () => undefined,
    }

    const platform = new WebPlatformAdapter()
    await platform.compile(bundler, {
      command: 'server',
      preConfig,
      compileContext: ctx,
      pluginManager,
    })

    expect(receivedConfig).toMatchObject({
      entry: 'index',
      devModified: true,
    })
    expect(order).toEqual([
      'before-create',
      'modify-rspack',
      'before-dev',
      'after-dev',
    ])
    expect(cleanups).toHaveLength(1)

    await cleanups[0]()
    expect(order).toEqual([
      'before-create',
      'modify-rspack',
      'before-dev',
      'after-dev',
      'close-dev',
    ])
  })
})
