import { describe, expect, it, vi } from 'vitest'

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
          quiet: true,
        }))
      },
    }

    const bundlerPlugin: IkarosPlugin = {
      name: 'bundler-plugin',
      setup(api: IkarosPluginAPI) {
        api.modifyRspackConfig((bundlerConfig: Record<string, unknown>) => ({
          ...bundlerConfig,
          fromRuntimePlugin: true,
        }))
      },
    }

    expect(manager.isPluginExists('config-plugin')).toBe(false)

    await manager.addPlugins([configPlugin])
    expect(manager.isPluginExists('config-plugin')).toBe(true)

    await manager.init()

    expect(await manager.applyIkarosConfig(undefined)).toEqual({
      quiet: true,
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
})
