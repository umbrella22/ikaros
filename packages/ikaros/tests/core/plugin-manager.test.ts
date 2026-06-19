import { beforeEach, describe, expect, it, vi } from 'vitest'

const loggerMocks = vi.hoisted(() => ({
  warning: vi.fn(),
}))

vi.mock('../../src/node/shared/logger', () => ({
  logger: {
    done: vi.fn(),
    error: vi.fn(),
    okay: vi.fn(),
    warning: loggerMocks.warning,
    info: vi.fn(),
  },
}))

import type { CompileContext } from '../../src/node/compile/compile-context'
import type { IkarosPluginAPI } from '../../src/node/core/plugin-api'
import { createPluginManager } from '../../src/node/core/plugin-manager'
import type { NormalizedConfig } from '../../src/node/config/normalize-config'
import type { IkarosPlugin } from '../../src/node/config/user-config'

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

function createCompileContext(): CompileContext {
  return {
    context: '/test/project',
    command: 'build' as CompileContext['command'],
    options: {
      platform: 'web',
    },
    env: {},
    userConfig: undefined,
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
    envCleanup: vi.fn(),
  }
}

describe('PluginManager', () => {
  beforeEach(() => {
    loggerMocks.warning.mockClear()
  })

  it('应支持 addPlugins、removePlugins 与 isPluginExists', async () => {
    const ctx = createCompileContext()
    const manager = createPluginManager({
      compileContext: ctx,
    })

    const configPlugin: IkarosPlugin = {
      name: 'config-plugin',
      setup(api: IkarosPluginAPI) {
        api.modifyIkarosConfig((config) => ({
          ...config,
          log: { level: 'quiet' },
        }))
      },
    }

    const bundlerPlugin: IkarosPlugin = {
      name: 'bundler-plugin',
      setup(api: IkarosPluginAPI) {
        api.modifyRspackConfig((bundlerConfig) => ({
          ...bundlerConfig,
          fromRuntimePlugin: true,
        } as never))
      },
    }

    expect(manager.isPluginExists('config-plugin')).toBe(false)

    await manager.addPlugins([configPlugin])
    expect(manager.isPluginExists('config-plugin')).toBe(true)

    await manager.init()

    expect(await manager.applyIkarosConfig(undefined)).toEqual({
      log: { level: 'quiet' },
    })

    await manager.addPlugins([bundlerPlugin])
    expect(manager.isPluginExists('bundler-plugin')).toBe(true)

    await manager.applyNormalizedConfig(createNormalizedConfig())

    expect(
      await manager.applyBundlerConfig('rspack', { entry: 'index' }),
    ).toMatchObject({
      entry: 'index',
      fromRuntimePlugin: true,
    })

    manager.removePlugins(['bundler-plugin'])

    expect(manager.isPluginExists('bundler-plugin')).toBe(false)
    expect(
      await manager.applyBundlerConfig('rspack', { entry: 'index' }),
    ).toEqual({
      entry: 'index',
    })
  })

  it('应按插件名去重，避免重复注册相同插件', async () => {
    const ctx = createCompileContext()
    const manager = createPluginManager({
      compileContext: ctx,
    })

    const plugin: IkarosPlugin = {
      name: 'dedupe-plugin',
      setup(api: IkarosPluginAPI) {
        api.modifyNormalizedConfig((config) => ({
          ...config,
          port: config.port + 1,
          server: {
            ...config.server,
            port: config.server.port + 1,
          },
        }))
      },
    }

    await manager.addPlugins([plugin, plugin])
    await manager.init()

    const config = await manager.applyNormalizedConfig(createNormalizedConfig())

    expect(config.port).toBe(3001)
    expect(config.server.port).toBe(3001)
    expect(manager.getPluginTraces()).toEqual([])
    expect(loggerMocks.warning).not.toHaveBeenCalled()
  })

  it('同名但不同对象的插件应跳过后注册项并记录 warning trace', async () => {
    const ctx = createCompileContext()
    const setupBuiltin = vi.fn()
    const setupUser = vi.fn()
    const manager = createPluginManager({
      compileContext: ctx,
      builtinPlugins: [
        {
          name: 'duplicate-plugin',
          setup: setupBuiltin,
        },
      ],
      plugins: [
        {
          name: 'duplicate-plugin',
          setup: setupUser,
        },
      ],
    })

    await manager.init()

    expect(setupBuiltin).toHaveBeenCalledOnce()
    expect(setupUser).not.toHaveBeenCalled()
    expect(manager.getPluginNames()).toEqual(['duplicate-plugin'])
    expect(loggerMocks.warning).toHaveBeenCalledWith({
      text: expect.stringContaining('建议运行 inspect 查看插件诊断'),
    })
    expect(manager.getPluginTraces()).toEqual([
      expect.objectContaining({
        hook: 'registerPlugin',
        plugin: 'duplicate-plugin',
        phase: 'warning',
        operation: 'skip-duplicate-plugin',
        target: 'builtin->user',
      }),
    ])
  })

  it('不同用户插件同名时应保留首个并记录 warning trace', async () => {
    const ctx = createCompileContext()
    const firstSetup = vi.fn()
    const secondSetup = vi.fn()
    const manager = createPluginManager({
      compileContext: ctx,
    })

    await manager.addPlugins([
      {
        name: 'same-user-plugin',
        setup: firstSetup,
      },
      {
        name: 'same-user-plugin',
        setup: secondSetup,
      },
    ])
    await manager.init()

    expect(firstSetup).toHaveBeenCalledOnce()
    expect(secondSetup).not.toHaveBeenCalled()
    expect(loggerMocks.warning).toHaveBeenCalledWith({
      text: expect.stringContaining('建议运行 inspect 查看插件诊断'),
    })
    expect(manager.getPluginTraces()).toEqual([
      expect.objectContaining({
        hook: 'registerPlugin',
        plugin: 'same-user-plugin',
        phase: 'warning',
        operation: 'skip-duplicate-plugin',
        target: 'user->user',
      }),
    ])
  })

  it('应逐项处理多配置 bundler config 并保留数组结构', async () => {
    const ctx = createCompileContext()
    const manager = createPluginManager({
      compileContext: ctx,
    })

    const plugin: IkarosPlugin = {
      name: 'multi-config-plugin',
      setup(api: IkarosPluginAPI) {
        api.modifyRspackConfig((bundlerConfig) => ({
          ...bundlerConfig,
          fromMultiConfigPlugin: true,
        } as never))
      },
    }

    await manager.addPlugins([plugin])
    await manager.init()
    await manager.applyNormalizedConfig(createNormalizedConfig())

    const bundlerConfig = await manager.applyBundlerConfig('rspack', [
      { entry: 'index-a' },
      { entry: 'index-b' },
    ])

    expect(Array.isArray(bundlerConfig)).toBe(true)
    expect(bundlerConfig).toEqual([
      {
        entry: 'index-a',
        fromMultiConfigPlugin: true,
      },
      {
        entry: 'index-b',
        fromMultiConfigPlugin: true,
      },
    ])
  })

  it('应暴露插件与 hook 的诊断信息', async () => {
    const ctx = createCompileContext()
    const manager = createPluginManager({
      compileContext: ctx,
    })

    const plugin: IkarosPlugin = {
      name: 'diagnostic-plugin',
      setup(api: IkarosPluginAPI) {
        api.modifyIkarosConfig((config) => config)
        api.onBeforeBuild(() => undefined)
      },
    }

    await manager.addPlugins([plugin])
    await manager.init()

    expect(manager.getPluginNames()).toEqual(['diagnostic-plugin'])
    expect(manager.getHookTapNames()).toMatchObject({
      modifyIkarosConfig: ['diagnostic-plugin'],
      onBeforeBuild: ['diagnostic-plugin'],
    })
  })

  it('应按内置/用户来源、enforce 与 order 排序插件', async () => {
    const ctx = createCompileContext()
    const calls: string[] = []
    const createPlugin = (
      name: string,
      options?: Pick<IkarosPlugin, 'enforce' | 'order'>,
    ): IkarosPlugin => ({
      name,
      ...options,
      setup(api) {
        calls.push(name)
        api.onBeforeBuild(() => undefined)
      },
    })

    const manager = createPluginManager({
      compileContext: ctx,
      builtinPlugins: [
        createPlugin('builtin-normal'),
        createPlugin('builtin-pre', { enforce: 'pre' }),
        createPlugin('builtin-post', { enforce: 'post' }),
      ],
      plugins: [
        createPlugin('user-post', { enforce: 'post' }),
        createPlugin('user-normal-high', { order: 10 }),
        createPlugin('user-pre', { enforce: 'pre' }),
        createPlugin('user-normal-low', { order: -1 }),
      ],
    })

    await manager.init()

    expect(calls).toEqual([
      'builtin-pre',
      'user-pre',
      'user-normal-low',
      'builtin-normal',
      'user-normal-high',
      'user-post',
      'builtin-post',
    ])
    expect(manager.getPluginNames()).toEqual(calls)
  })

  it('应支持按稳定 ID 修改 Rspack rules 和 plugins 并记录来源', async () => {
    const ctx = createCompileContext()
    const manager = createPluginManager({
      compileContext: ctx,
      plugins: [
        {
          name: 'semantic-plugin',
          setup(api) {
            api.modifyRspackRules((rules) => {
              const rule = rules.get('script:js')
              if (rule) {
                rules.set('script:js', {
                  ...rule,
                  exclude: /vendor/,
                })
              }
              rules.disable('asset:image')
            })
            api.modifyRspackPlugins((plugins) => {
              plugins.append('custom:plugin', { name: 'CustomPlugin' } as never)
              plugins.append('custom:plugin-array', [
                { name: 'ArrayPluginA' },
                { name: 'ArrayPluginB' },
              ] as never)
            })
          },
        },
      ],
    })
    await manager.init()
    await manager.applyNormalizedConfig(createNormalizedConfig())

    const config = await manager.applyBundlerConfig('rspack', {
      module: {
        rules: [
          {
            test: /\.m?js$/i,
            loader: 'builtin:swc-loader',
            exclude: /node_modules/,
          },
          {
            test: /\.(png|svg)$/,
            type: 'asset/resource',
          },
        ],
      },
      plugins: [],
    })

    expect(config.module?.rules).toHaveLength(1)
    expect(config.module?.rules?.[0]).toMatchObject({
      loader: 'builtin:swc-loader',
      exclude: /vendor/,
    })
    const pluginNames = (config.plugins as Array<{ name?: string }>).map(
      (plugin) => plugin.name,
    )
    expect(pluginNames).toEqual([
      'CustomPlugin',
      'ArrayPluginA',
      'ArrayPluginB',
    ])
    expect(manager.getPluginTraces()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          hook: 'modifyRspackRules',
          plugin: 'semantic-plugin',
          operation: 'set',
          target: 'script:js',
        }),
        expect.objectContaining({
          hook: 'modifyRspackRules',
          plugin: 'semantic-plugin',
          operation: 'disable',
          target: 'asset:image',
        }),
        expect.objectContaining({
          hook: 'modifyRspackPlugins',
          plugin: 'semantic-plugin',
          operation: 'append',
          target: 'custom:plugin',
        }),
        expect.objectContaining({
          hook: 'modifyRspackPlugins',
          plugin: 'semantic-plugin',
          operation: 'append',
          target: 'custom:plugin-array',
        }),
      ]),
    )
  })
})
