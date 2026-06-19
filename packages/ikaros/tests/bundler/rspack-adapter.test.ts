import { describe, expect, it } from 'vitest'

import { RspackAdapter } from '../../src/node/bundler/rspack'
import { createBuildPlan } from '../../src/node/build-plan'
import type { CreateConfigParams } from '../../src/node/bundler/types'
import type { NormalizedConfig } from '../../src/node/config/normalize-config'
import { ELECTRON_RENDERER_SUBDIR } from '../../src/node/shared/constants'

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<unknown>
    ? T[K]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K]
}

const resolveTestContext = (...paths: string[]) =>
  [process.cwd(), ...paths].join('/')

const createNormalizedConfig = (
  overrides?: DeepPartial<NormalizedConfig>,
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
    } as NormalizedConfig['pages'],
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
      } as NormalizedConfig['resolve']['alias'],
      extensions: overrides?.resolve?.extensions ?? base.resolve.extensions,
    },
  }
}

const createParams = (
  command: CreateConfigParams['command'],
  overrides?: Omit<Partial<CreateConfigParams>, 'config'> & {
    config?: DeepPartial<NormalizedConfig>
  },
): CreateConfigParams => {
  const config = createNormalizedConfig(overrides?.config)

  return {
    command,
    mode: undefined,
    env: {},
    context: process.cwd(),
    contextPkg: { name: 'test-app', version: '0.0.1' },
    resolveContext: resolveTestContext,
    ...overrides,
    config,
  }
}

const createPlan = (
  command: CreateConfigParams['command'],
  overrides?: Omit<Partial<CreateConfigParams>, 'config'> & {
    config?: DeepPartial<NormalizedConfig>
  },
) => {
  const params = createParams(command, overrides)
  return createBuildPlan({
    id: params.config.isElectron ? 'electron-renderer' : 'web',
    command,
    platform: params.config.isElectron ? 'desktopClient' : 'web',
    target: params.config.isElectron ? 'electron-renderer' : 'web',
    mode: params.mode,
    context: params.context,
    contextPkg: params.contextPkg,
    env: params.env,
    config: params.config,
  })
}

describe('RspackAdapter', () => {
  it('name 应为 "rspack"', () => {
    const adapter = new RspackAdapter()
    expect(adapter.name).toBe('rspack')
  })

  it('createConfig() 应返回有效的 rspack Configuration', () => {
    const adapter = new RspackAdapter()
    const config = adapter.createConfig(createPlan('server'))

    expect(config).toBeDefined()
    expect(config).toHaveProperty('mode', 'development')
    expect(config).toHaveProperty('entry')
    expect(config).toHaveProperty('plugins')
    expect(config).toHaveProperty('module')
  })

  it('createConfig() build 模式应返回 production', () => {
    const adapter = new RspackAdapter()
    const config = adapter.createConfig(createPlan('build'))

    expect(config).toHaveProperty('mode', 'production')
  })

  it('应生成 Rspack 2 兼容的 loader targets 与 transformImport 配置', () => {
    const adapter = new RspackAdapter()
    const config = adapter.createConfig(
      createPlan('server', {
        config: {
          browserslist: 'chrome >= 90, safari >= 16',
          rspack: {
            swc: {
              jsc: {
                transform: {
                  react: {
                    runtime: 'automatic',
                    development: true,
                    refresh: true,
                  },
                },
              },
            },
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
          exclude?: RegExp
          use?: Array<{
            loader: string
            options?: Record<string, unknown>
          }>
        }>
      }
    }

    const rules = config.module?.rules ?? []
    const jsxRule = rules.find((rule) => rule.test?.source === '\\.jsx$')
    const tsxRule = rules.find((rule) => rule.test?.source === '\\.tsx$')
    const jsRule = rules.find((rule) => rule.test?.source === '\\.m?js$')
    const cssRule = rules.find((rule) => rule.test?.source === '\\.css$')

    expect(jsxRule?.options?.jsc).toMatchObject({
      parser: {
        syntax: 'ecmascript',
        jsx: true,
      },
      transform: {
        react: {
          runtime: 'automatic',
          development: true,
          refresh: true,
        },
      },
    })
    expect(tsxRule?.options?.jsc).toMatchObject({
      parser: {
        syntax: 'typescript',
        jsx: true,
      },
      transform: {
        react: {
          runtime: 'automatic',
          development: true,
          refresh: true,
        },
      },
    })
    expect(jsRule?.options?.transformImport).toEqual([
      {
        libraryName: 'antd',
        style: true,
      },
    ])
    expect(jsRule?.options).not.toHaveProperty('rspackExperiments')
    expect(jsRule?.exclude).toEqual(/node_modules/)
    expect(cssRule?.use?.[0]?.options?.targets).toBe(
      'chrome >= 90, safari >= 16',
    )
  })

  it('未提供 swc 时不应注入任何 React 变换(框架无关)', () => {
    const adapter = new RspackAdapter()
    const config = adapter.createConfig(createPlan('server')) as {
      module?: {
        rules?: Array<{
          test?: RegExp
          options?: Record<string, unknown>
        }>
      }
    }

    const rules = config.module?.rules ?? []
    const jsxRule = rules.find((rule) => rule.test?.source === '\\.jsx$')
    const tsxRule = rules.find((rule) => rule.test?.source === '\\.tsx$')

    const readReact = (rule: typeof jsxRule) =>
      (rule?.options?.jsc as { transform?: { react?: unknown } })?.transform
        ?.react

    // ikaros 只保留 parser 默认,不强加 transform.react —— Vue/非 React 项目不受影响
    expect(readReact(jsxRule)).toBeUndefined()
    expect(readReact(tsxRule)).toBeUndefined()
    expect((jsxRule?.options?.jsc as { parser?: unknown })?.parser).toMatchObject(
      { syntax: 'ecmascript', jsx: true },
    )
  })

  it('应组装可复用的 web 输出与 dev server 配置', () => {
    const adapter = new RspackAdapter()
    const config = adapter.createConfig(
      createPlan('server', {
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
            } as never,
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
    expect(config).toHaveProperty(
      'devServer.historyApiFallback.rewrites.1.to',
      '/app/index.html',
    )
    expect(
      String(
        (config as {
          devServer?: {
            historyApiFallback?: { rewrites?: Array<{ to?: unknown }> }
          }
        }).devServer?.historyApiFallback?.rewrites?.[1]?.to,
      ),
    ).not.toContain('\\')
  })

  it('electron renderer 模式应使用相对 publicPath 与 renderer 输出目录', () => {
    const adapter = new RspackAdapter()
    const config = adapter.createConfig(
      createPlan('build', {
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
