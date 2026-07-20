import type { Configuration } from '@rspack/core'
import { describe, expect, it, vi } from 'vitest'

import type { CompileContext } from '../../src/node/compile/compile-context'
import { createBuiltinPlugins } from '../../src/node/core/builtin-plugins'
import { createPluginManager } from '../../src/node/core/plugin-manager'
import type { NormalizedConfig } from '../../src/node/config/normalize-config'

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<unknown>
    ? T[K]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K]
}

function createNormalizedConfig(
  overrides?: DeepPartial<NormalizedConfig>,
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
      config: {},
      configFile: false,
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
    pages: {
      ...base.pages,
      ...(overrides?.pages ?? {}),
    } as NormalizedConfig['pages'],
    build: {
      ...base.build,
      ...(overrides?.build ?? {}),
    },
    vite: {
      ...base.vite,
      ...(overrides?.vite ?? {}),
    },
    server: {
      ...base.server,
      ...(overrides?.server ?? {}),
    },
    resolve: {
      ...base.resolve,
      ...(overrides?.resolve ?? {}),
      alias: {
        ...base.resolve.alias,
        ...(overrides?.resolve?.alias ?? {}),
      } as NormalizedConfig['resolve']['alias'],
      extensions: overrides?.resolve?.extensions ?? base.resolve.extensions,
    },
    rspack: {
      ...base.rspack,
      ...(overrides?.rspack ?? {}),
      plugins: overrides?.rspack?.plugins ?? base.rspack.plugins,
      loaders: overrides?.rspack?.loaders ?? base.rspack.loaders,
      experiments: {
        ...base.rspack.experiments,
        ...(overrides?.rspack?.experiments ?? {}),
      },
      moduleFederation:
        overrides?.rspack?.moduleFederation ?? base.rspack.moduleFederation,
      cdnOptions: {
        ...base.rspack.cdnOptions,
        ...(overrides?.rspack?.cdnOptions ?? {}),
      },
      css: {
        ...base.rspack.css,
        ...(overrides?.rspack?.css ?? {}),
      },
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

function readPluginName(plugin: unknown): string {
  if (
    plugin &&
    typeof plugin === 'object' &&
    'name' in plugin &&
    typeof plugin.name === 'string'
  ) {
    return plugin.name
  }

  if (
    plugin &&
    typeof plugin === 'object' &&
    'constructor' in plugin &&
    plugin.constructor &&
    typeof plugin.constructor === 'function'
  ) {
    return plugin.constructor.name
  }

  return 'unknown'
}

function readDefinePluginOptions(plugin: unknown): Record<string, unknown> | undefined {
  if (
    plugin &&
    typeof plugin === 'object' &&
    '_args' in plugin &&
    Array.isArray(plugin._args)
  ) {
    return plugin._args[0] as Record<string, unknown>
  }

  return undefined
}

describe('builtin framework plugins', () => {
  it('应把 env 注入 import.meta.env 并保持 source.define 为裸 key', async () => {
    const ctx = createCompileContext()
    ctx.env = {
      FOO: 'from-env',
    }
    const pluginManager = createPluginManager({
      compileContext: ctx,
      plugins: createBuiltinPlugins(ctx),
    })

    await pluginManager.init()
    await pluginManager.applyNormalizedConfig(
      createNormalizedConfig({
        define: {
          __APP__: 'demo',
        },
      }),
    )

    const bundlerConfig = await pluginManager.applyBundlerConfig('rspack', {
      plugins: [],
    } as Configuration)
    const definePlugin = bundlerConfig.plugins?.find(
      (plugin) => readPluginName(plugin) === 'DefinePlugin',
    )
    const defineOptions = readDefinePluginOptions(definePlugin)

    expect(defineOptions).toMatchObject({
      'import.meta.env.FOO': '"from-env"',
      __APP__: '"demo"',
    })
    expect(defineOptions).not.toHaveProperty('FOO')
    expect(defineOptions).not.toHaveProperty('import.meta.env.__APP__')
  })

  it('应把 rspack 核心框架插件、输出增强、CDN 和生态能力注入最终 bundler config', async () => {
    const ctx = createCompileContext()
    ctx.preWarnings.push({
      source: 'test',
      message: 'from compile context',
    })

    const pluginManager = createPluginManager({
      compileContext: ctx,
      plugins: createBuiltinPlugins(ctx),
    })

    await pluginManager.init()

    const preConfig = await pluginManager.applyNormalizedConfig(
      createNormalizedConfig({
        build: {
          sourceMap: true,
          gzip: true,
          outReport: true,
          cache: true,
          dependencyCycleCheck: true,
          base: '/',
          assetsDir: '',
          outDirName: 'dist',
        },
        rspack: {
          cdnOptions: {
            modules: [
              {
                name: 'vue',
                var: 'Vue',
                path: 'dist/vue.runtime.esm-browser.js',
              },
            ],
          },
          moduleFederation: [{ name: 'remote-app' } as never],
          plugins: [{ name: 'user-rspack-plugin' } as never],
        },
      }),
    )

    const bundlerConfig = await pluginManager.applyBundlerConfig('rspack', {
      plugins: [{ name: 'base-plugin' } as never],
    } as Configuration)

    const pluginNames = (bundlerConfig.plugins ?? []).map(readPluginName)
    const minimizerNames = (bundlerConfig.optimization?.minimizer ?? []).map(
      readPluginName,
    )

    expect(bundlerConfig.externals).toEqual({
      vue: 'Vue',
    })
    expect(bundlerConfig.cache).toMatchObject({
      type: 'persistent',
    })
    expect(bundlerConfig.experiments).toBeUndefined()
    expect(bundlerConfig.optimization).toMatchObject({
      minimize: true,
      splitChunks: {
        chunks: 'all',
      },
    })
    expect(minimizerNames).toContain('LightningCssMinimizerRspackPlugin')
    expect(minimizerNames).toContain('SwcJsMinimizerRspackPlugin')
    expect(pluginNames).toContain('DefinePlugin')
    expect(pluginNames).toContain('CopyRspackPlugin')
    expect(pluginNames).toContain('HtmlRspackPlugin')
    expect(pluginNames).toContain('PreWarningsPlugin')
    expect(pluginNames).toContain('StatsPlugin')
    expect(pluginNames).toContain('SourceMapDevToolPlugin')
    expect(pluginNames).toContain('CssExtractRspackPlugin')
    expect(pluginNames).toContain('CompressionPlugin')
    expect(pluginNames).toContain('CdnPlugin')
    expect(
      pluginNames.some((name) =>
        name.toLowerCase().includes('modulefederation'),
      ),
    ).toBe(true)
    expect(
      pluginNames.some((name) =>
        name.toLowerCase().includes('circulardependencyrspackplugin'),
      ),
    ).toBe(true)
    expect(pluginNames.at(0)).toBe('base-plugin')
    expect(pluginNames.at(-1)).toBe('user-rspack-plugin')
    expect(preConfig.rspack.cdnOptions.modules).toHaveLength(1)
  })

  it('CDN externals 应合并已有 plain object externals', async () => {
    const ctx = createCompileContext()
    const pluginManager = createPluginManager({
      compileContext: ctx,
      plugins: createBuiltinPlugins(ctx),
    })

    await pluginManager.init()
    await pluginManager.applyNormalizedConfig(
      createNormalizedConfig({
        rspack: {
          cdnOptions: {
            modules: [
              {
                name: 'vue',
                var: 'Vue',
              },
            ],
          },
        },
      }),
    )

    const bundlerConfig = await pluginManager.applyBundlerConfig('rspack', {
      externals: {
        react: 'React',
      },
    } as Configuration)

    expect(bundlerConfig.externals).toEqual({
      react: 'React',
      vue: 'Vue',
    })
  })

  it('CDN externals 遇到复杂 externals 形态时应保留原值', async () => {
    const ctx = createCompileContext()
    const pluginManager = createPluginManager({
      compileContext: ctx,
      plugins: createBuiltinPlugins(ctx),
    })

    await pluginManager.init()
    await pluginManager.applyNormalizedConfig(
      createNormalizedConfig({
        rspack: {
          cdnOptions: {
            modules: [
              {
                name: 'vue',
                var: 'Vue',
              },
            ],
          },
        },
      }),
    )

    const externals = ['react']
    const bundlerConfig = await pluginManager.applyBundlerConfig('rspack', {
      externals,
    } as Configuration)

    expect(bundlerConfig.externals).toBe(externals)
  })

  it('库模式应跳过页面与应用专用增强', async () => {
    const ctx = createCompileContext()

    const pluginManager = createPluginManager({
      compileContext: ctx,
      plugins: createBuiltinPlugins(ctx),
    })

    await pluginManager.init()

    await pluginManager.applyNormalizedConfig(
      createNormalizedConfig({
        library: {
          entry: 'src/index.ts',
          name: 'MyLib',
          formats: ['es', 'umd'],
        },
        rspack: {
          plugins: [{ name: 'user-rspack-plugin' } as never],
          cdnOptions: {
            modules: [
              {
                name: 'vue',
                var: 'Vue',
                path: 'dist/vue.runtime.esm-browser.js',
              },
            ],
          },
          moduleFederation: [{ name: 'remote-app' } as never],
        },
      }),
    )

    const bundlerConfig = (await pluginManager.applyBundlerConfig('rspack', [
      {
        entry: '/test/project/src/index.ts',
        plugins: [],
        optimization: {},
      },
      {
        entry: '/test/project/src/index.ts',
        plugins: [],
        optimization: {},
      },
    ])) as Configuration[]

    expect(Array.isArray(bundlerConfig)).toBe(true)

    for (const config of bundlerConfig) {
      const pluginNames = (config.plugins ?? []).map(readPluginName)

      expect(pluginNames).toContain('DefinePlugin')
      expect(pluginNames).toContain('PreWarningsPlugin')
      expect(pluginNames).toContain('StatsPlugin')
      expect(pluginNames).toContain('CssExtractRspackPlugin')
      expect(pluginNames).not.toContain('CopyRspackPlugin')
      expect(pluginNames).not.toContain('HtmlRspackPlugin')
      expect(pluginNames).not.toContain('CdnPlugin')
      expect(pluginNames).not.toContain('user-rspack-plugin')
      expect(
        pluginNames.some((name) =>
          name.toLowerCase().includes('modulefederation'),
        ),
      ).toBe(false)
      expect(config.externals).toBeUndefined()
      expect(config.optimization?.splitChunks).toBeUndefined()
    }
  })
})
