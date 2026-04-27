import { describe, expect, it } from 'vitest'

import { RspackAdapter } from '../../src/node/bundler/rspack'
import type { CreateConfigParams } from '../../src/node/bundler/types'
import type { NormalizedConfig } from '../../src/node/config/normalize-config'
import { ELECTRON_RENDERER_SUBDIR } from '../../src/node/shared/constants'

const resolveTestContext = (...paths: string[]) =>
  [process.cwd(), ...paths].join('/')

const createNormalizedConfig = (
  overrides?: Partial<NormalizedConfig>,
): NormalizedConfig => {
  const base: NormalizedConfig = {
    bundler: 'rspack',
    plugins: [],
    quiet: false,
    target: 'pc',
    pages: {
      index: {
        html: 'index.html',
        entry: 'src/index.ts',
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
      port: 8080,
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
        '@': resolveTestContext('src'),
      },
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
    },
    library: null,
    electron: {},
    base: '/',
    port: 8080,
    browserslist: 'defaults',
    isElectron: false,
    isVue: false,
    isReact: false,
  }

  return {
    ...base,
    ...overrides,
    pages: {
      ...base.pages,
      ...(overrides?.pages ?? {}),
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
    vite: {
      ...base.vite,
      ...(overrides?.vite ?? {}),
    },
    server: {
      ...base.server,
      ...(overrides?.server ?? {}),
    },
    build: {
      ...base.build,
      ...(overrides?.build ?? {}),
    },
    resolve: {
      ...base.resolve,
      ...(overrides?.resolve ?? {}),
      alias: {
        ...base.resolve.alias,
        ...(overrides?.resolve?.alias ?? {}),
      },
      extensions: overrides?.resolve?.extensions ?? base.resolve.extensions,
    },
  }
}

const createParams = (
  command: CreateConfigParams['command'],
  overrides?: Partial<CreateConfigParams>,
): CreateConfigParams => {
  const config = createNormalizedConfig(overrides?.config)

  return {
    command,
    mode: undefined,
    env: {},
    context: process.cwd(),
    contextPkg: { name: 'test-app', version: '0.0.1' },
    config,
    resolveContext: resolveTestContext,
    ...overrides,
    config,
  }
}

describe('RspackAdapter', () => {
  it('name 应为 "rspack"', () => {
    const adapter = new RspackAdapter()
    expect(adapter.name).toBe('rspack')
  })

  it('createConfig() 应返回有效的 rspack Configuration', () => {
    const adapter = new RspackAdapter()
    const config = adapter.createConfig(createParams('server'))

    expect(config).toBeDefined()
    expect(config).toHaveProperty('mode', 'development')
    expect(config).toHaveProperty('entry')
    expect(config).toHaveProperty('plugins')
    expect(config).toHaveProperty('module')
  })

  it('createConfig() build 模式应返回 production', () => {
    const adapter = new RspackAdapter()
    const config = adapter.createConfig(createParams('build'))

    expect(config).toHaveProperty('mode', 'production')
  })

  it('应生成 Rspack 2 兼容的 loader targets 与 transformImport 配置', () => {
    const adapter = new RspackAdapter()
    const config = adapter.createConfig(
      createParams('server', {
        config: {
          browserslist: 'chrome >= 90, safari >= 16',
          rspack: {
            experiments: {
              import: [
                {
                  libraryName: 'antd',
                  style: true,
                },
              ],
            },
          },
        },
      }),
    ) as {
      module?: {
        rules?: Array<{
          test?: RegExp
          loader?: string
          options?: Record<string, unknown>
          use?: Array<{
            loader: string
            options?: Record<string, unknown>
          }>
        }>
      }
    }

    const rules = config.module?.rules ?? []
    const jsRule = rules.find((rule) => rule.test?.source === '\\.m?js$')
    const cssRule = rules.find((rule) => rule.test?.source === '\\.css$')

    expect(jsRule?.options?.transformImport).toEqual([
      {
        libraryName: 'antd',
        style: true,
      },
    ])
    expect(jsRule?.options).not.toHaveProperty('rspackExperiments')
    expect(cssRule?.use?.[0]?.options?.targets).toBe(
      'chrome >= 90, safari >= 16',
    )
  })

  it('应组装可复用的 web 输出与 dev server 配置', () => {
    const adapter = new RspackAdapter()
    const config = adapter.createConfig(
      createParams('server', {
        contextPkg: { name: 'demo-app', version: '0.0.1' },
        config: {
          base: '/app/',
          port: 9090,
          build: {
            base: '/app/',
          },
          server: {
            port: 9090,
            proxy: {
              '/api': 'http://localhost:3001',
            },
            https: {
              key: 'test-key',
            } as never,
          },
        },
      }),
    )

    expect(config).toHaveProperty('output.publicPath', '/app/')
    expect(config).toHaveProperty('output.chunkLoadingGlobal', 'demo-app_chunk')
    expect(config).toHaveProperty('devServer.port', 9090)
    expect(config).toHaveProperty('devServer.allowedHosts', 'all')
    expect(config).toHaveProperty(
      'devServer.proxy./api',
      'http://localhost:3001',
    )
    expect(config).toHaveProperty('devServer.static.publicPath', '/app/')
    expect(config).toHaveProperty(
      'devServer.client.webSocketURL',
      'auto://0.0.0.0:9090/ws',
    )
    expect(config).toHaveProperty('devServer.server.type', 'https')
  })

  it('electron renderer 模式应使用相对 publicPath 与 renderer 输出目录', () => {
    const adapter = new RspackAdapter()
    const config = adapter.createConfig(
      createParams('build', {
        config: {
          isElectron: true,
          electron: {
            build: {
              outDir: 'custom-electron-dist',
            },
          },
        },
      }),
    )

    expect(config).toHaveProperty('target', 'electron-renderer')
    expect(config).toHaveProperty('output.publicPath', './')
    expect(config).toHaveProperty(
      'output.path',
      resolveTestContext('custom-electron-dist', ELECTRON_RENDERER_SUBDIR),
    )
  })
})
