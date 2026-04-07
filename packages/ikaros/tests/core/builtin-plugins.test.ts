import type { Configuration } from '@rspack/core'
import { describe, expect, it, vi } from 'vitest'

import type { CompileContext } from '../../src/node/compile/compile-context'
import { createBuiltinPlugins } from '../../src/node/core/builtin-plugins'
import { createPluginManager } from '../../src/node/core/plugin-manager'
import type { NormalizedConfig } from '../../src/node/config/normalize-config'

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

describe('builtin framework plugins', () => {
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
    } satisfies Configuration)

    const pluginNames = (bundlerConfig.plugins ?? []).map(readPluginName)
    const minimizerNames = (bundlerConfig.optimization?.minimizer ?? []).map(
      readPluginName,
    )

    expect(bundlerConfig.externals).toEqual({
      vue: 'Vue',
    })
    expect(bundlerConfig.cache).toBe(true)
    expect(bundlerConfig.experiments).toMatchObject({
      css: true,
      cache: {
        type: 'persistent',
      },
    })
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
})
