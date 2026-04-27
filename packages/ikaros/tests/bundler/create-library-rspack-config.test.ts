import { describe, expect, it } from 'vitest'

import { createLibraryRspackConfigs } from '../../src/node/bundler/rspack/create-library-rspack-config'
import type { CreateConfigParams } from '../../src/node/bundler/types'
import type { NormalizedConfig } from '../../src/node/config/normalize-config'

interface TestCfg {
  output: {
    library: { type: string; name?: string }
    filename: string
    path: string
    module?: boolean
    globalObject?: string
  }
  entry: string | Record<string, string>
  externals: unknown
  resolve: { alias: Record<string, string> }
  module?: {
    rules?: Array<{
      test?: RegExp
      loader?: string
      use?: Array<{
        loader: string
      }>
    }>
  }
  devtool: string | false
  plugins?: Array<{ name?: string }>
}

const resolveTestContext = (...paths: string[]) =>
  ['/test/project', ...paths].join('/')

const createMinimalConfig = (
  overrides?: Partial<NormalizedConfig>,
): NormalizedConfig => {
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

const createMinimalParams = (
  overrides?: Partial<CreateConfigParams>,
): CreateConfigParams => {
  const config = createMinimalConfig(overrides?.config)

  return {
    command: 'build',
    env: {},
    context: '/test/project',
    contextPkg: { name: 'my-lib', version: '1.0.0' },
    config,
    resolveContext: resolveTestContext,
    ...overrides,
    config,
  }
}

describe('createLibraryRspackConfigs', () => {
  it('应该为单入口生成默认 es + umd 两个配置', () => {
    const configs = createLibraryRspackConfigs(
      createMinimalParams({
        config: {
          library: {
            entry: 'src/index.ts',
            name: 'MyLib',
          },
        },
      }),
    )

    expect(Array.isArray(configs)).toBe(true)
    const arr = configs as TestCfg[]
    expect(arr).toHaveLength(2)
    expect(arr[0].output.library.type).toBe('module')
    expect(arr[0].output.module).toBe(true)
    expect(arr[1].output.library.type).toBe('umd')
    expect(arr[1].output.library.name).toBe('MyLib')
  })

  it('应该为多入口生成默认 es + cjs 两个配置', () => {
    const configs = createLibraryRspackConfigs(
      createMinimalParams({
        config: {
          library: {
            entry: { main: 'src/index.ts', utils: 'src/utils.ts' },
          },
        },
      }),
    )

    expect(Array.isArray(configs)).toBe(true)
    const arr = configs as TestCfg[]
    expect(arr).toHaveLength(2)
    expect(arr[0].output.library.type).toBe('module')
    expect(arr[1].output.library.type).toBe('commonjs2')
  })

  it('自定义 formats 应只生成指定格式', () => {
    const config = createLibraryRspackConfigs(
      createMinimalParams({
        config: {
          library: {
            entry: 'src/index.ts',
            formats: ['cjs'],
          },
        },
      }),
    )

    expect(Array.isArray(config)).toBe(false)
    expect((config as TestCfg).output.library.type).toBe('commonjs2')
  })

  it('es 格式应输出 ESM 模块', () => {
    const config = createLibraryRspackConfigs(
      createMinimalParams({
        config: {
          library: {
            entry: 'src/index.ts',
            formats: ['es'],
          },
        },
      }),
    )

    const cfg = config as TestCfg
    expect(cfg.output.module).toBe(true)
    expect(cfg.output.library.type).toBe('module')
  })

  it('umd 格式应设置 library.name', () => {
    const config = createLibraryRspackConfigs(
      createMinimalParams({
        config: {
          library: {
            entry: 'src/index.ts',
            name: 'MyLib',
            formats: ['umd'],
          },
        },
      }),
    )

    const cfg = config as TestCfg
    expect(cfg.output.library.name).toBe('MyLib')
    expect(cfg.output.library.type).toBe('umd')
    expect(cfg.output.globalObject).toBe('this')
  })

  it('应正确处理 externals', () => {
    const config = createLibraryRspackConfigs(
      createMinimalParams({
        config: {
          library: {
            entry: 'src/index.ts',
            formats: ['es'],
            externals: ['vue', 'react'],
          },
        },
      }),
    )

    const cfg = config as TestCfg
    expect(cfg.externals).toEqual(['vue', 'react'])
  })

  it('umd 格式应处理 externals + globals 映射', () => {
    const config = createLibraryRspackConfigs(
      createMinimalParams({
        config: {
          library: {
            entry: 'src/index.ts',
            name: 'MyLib',
            formats: ['umd'],
            externals: ['vue'],
            globals: { vue: 'Vue' },
          },
        },
      }),
    )

    const cfg = config as TestCfg & {
      externals: Record<string, { root?: string }>
    }
    expect(cfg.externals).toHaveProperty('vue')
    expect(cfg.externals.vue.root).toBe('Vue')
  })

  it('应使用自定义 fileName', () => {
    const config = createLibraryRspackConfigs(
      createMinimalParams({
        config: {
          library: {
            entry: 'src/index.ts',
            formats: ['cjs'],
            fileName: 'my-custom-name',
          },
        },
      }),
    )

    const cfg = config as TestCfg
    expect(cfg.output.filename).toBe('my-custom-name.cjs')
  })

  it('应使用 fileName 函数', () => {
    const config = createLibraryRspackConfigs(
      createMinimalParams({
        config: {
          library: {
            entry: 'src/index.ts',
            formats: ['es'],
            fileName: (format, entryName) => `${entryName}.${format}.custom`,
          },
        },
      }),
    )

    const cfg = config as TestCfg
    expect(cfg.output.filename).toBe('index.es.custom.js')
  })

  it('应解析 entry 路径', () => {
    const config = createLibraryRspackConfigs(
      createMinimalParams({
        config: {
          library: {
            entry: 'src/index.ts',
            formats: ['es'],
          },
        },
      }),
    )

    const cfg = config as TestCfg
    expect(cfg.entry).toBe('/test/project/src/index.ts')
  })

  it('应保留 resolve.alias 配置', () => {
    const config = createLibraryRspackConfigs(
      createMinimalParams({
        config: {
          library: {
            entry: 'src/index.ts',
            formats: ['es'],
          },
          resolve: {
            alias: { '~': '/custom/path' },
          },
        },
      }),
    )

    const cfg = config as TestCfg
    expect(cfg.resolve.alias).toHaveProperty('@', '/test/project/src')
    expect(cfg.resolve.alias).toHaveProperty('~', '/custom/path')
  })

  it('应使用自定义 outDirName', () => {
    const config = createLibraryRspackConfigs(
      createMinimalParams({
        config: {
          library: {
            entry: 'src/index.ts',
            formats: ['es'],
          },
          build: {
            outDirName: 'output',
          },
        },
      }),
    )

    const cfg = config as TestCfg
    expect(cfg.output.path).toBe('/test/project/output')
  })

  it('应该在 build.sourceMap 为 true 时启用 source-map', () => {
    const config = createLibraryRspackConfigs(
      createMinimalParams({
        config: {
          library: {
            entry: 'src/index.ts',
            formats: ['es'],
          },
          build: {
            sourceMap: true,
          },
        },
      }),
    )

    const cfg = config as TestCfg
    expect(cfg.devtool).toBe('source-map')
  })

  it('应读取 rspack 命名空间中的 plugins', () => {
    const config = createLibraryRspackConfigs(
      createMinimalParams({
        config: {
          library: {
            entry: 'src/index.ts',
            formats: ['cjs'],
          },
          rspack: {
            plugins: [{ name: 'custom-rspack-plugin' } as never],
          },
        },
      }),
    )

    const cfg = config as TestCfg
    expect(
      cfg.plugins?.some((plugin) => plugin.name === 'custom-rspack-plugin'),
    ).toBe(true)
  })

  it('应将自定义 rspack loaders 合入库模式配置', () => {
    const config = createLibraryRspackConfigs(
      createMinimalParams({
        config: {
          isVue: true,
          library: {
            entry: 'src/index.ts',
            name: 'MyLib',
            formats: ['es'],
          },
          rspack: {
            loaders: [
              {
                test: /\.vue$/,
                loader: 'rspack-vue-loader',
              } as never,
            ],
          },
        },
      }),
    ) as TestCfg

    expect(config.module?.rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          test: /\.vue$/,
          loader: 'rspack-vue-loader',
        }),
      ]),
    )
  })

  it('没有 library 配置应该抛出错误', () => {
    expect(() =>
      createLibraryRspackConfigs(
        createMinimalParams({
          config: {
            library: null,
          },
        }),
      ),
    ).toThrow('library config is required')
  })
})
