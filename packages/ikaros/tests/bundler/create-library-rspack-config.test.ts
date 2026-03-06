import { describe, it, expect } from 'vitest'

import { createLibraryRspackConfigs } from '../../src/node/bundler/rspack/create-library-rspack-config'
import type { CreateConfigParams } from '../../src/node/bundler/types'

interface TestCfg {
  output: {
    library: { type: string; name?: string }
    filename: string
    path: string
    module?: boolean
    globalObject?: string
  }
  entry: string | Record<string, string>
  experiments?: { outputModule?: boolean }
  externals: Record<string, Record<string, string>>
  resolve: { alias: Record<string, string> }
  devtool: string | false
}

const createMinimalParams = (
  overrides?: Partial<CreateConfigParams>,
): CreateConfigParams => ({
  command: 'build',
  env: {},
  context: '/test/project',
  contextPkg: { name: 'my-lib', version: '1.0.0' },
  pages: {
    index: {
      html: '/test/project/index.html',
      entry: '/test/project/src/index.ts',
    },
  },
  base: '/',
  port: 3000,
  browserslist: 'defaults',
  isElectron: false,
  isVue: false,
  isReact: false,
  resolveContext: (...paths: string[]) => `/test/project/${paths.join('/')}`,
  ...overrides,
})

describe('createLibraryRspackConfigs', () => {
  it('应该为单入口生成默认 es + umd 两个配置', () => {
    const configs = createLibraryRspackConfigs(
      createMinimalParams({
        userConfig: {
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

    // ES 格式
    expect(arr[0].output.library.type).toBe('module')
    expect(arr[0].experiments?.outputModule).toBe(true)

    // UMD 格式
    expect(arr[1].output.library.type).toBe('umd')
    expect(arr[1].output.library.name).toBe('MyLib')
  })

  it('应该为多入口生成默认 es + cjs 两个配置', () => {
    const configs = createLibraryRspackConfigs(
      createMinimalParams({
        userConfig: {
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
        userConfig: {
          library: {
            entry: 'src/index.ts',
            formats: ['cjs'],
          },
        },
      }),
    )

    // 单一格式返回单个 Configuration
    expect(Array.isArray(config)).toBe(false)
    expect((config as TestCfg).output.library.type).toBe('commonjs2')
  })

  it('es 格式应启用 outputModule', () => {
    const config = createLibraryRspackConfigs(
      createMinimalParams({
        userConfig: {
          library: {
            entry: 'src/index.ts',
            formats: ['es'],
          },
        },
      }),
    )

    const cfg = config as TestCfg
    expect(cfg.experiments?.outputModule).toBe(true)
    expect(cfg.output?.module).toBe(true)
    expect(cfg.output?.library?.type).toBe('module')
  })

  it('umd 格式应设置 library.name', () => {
    const config = createLibraryRspackConfigs(
      createMinimalParams({
        userConfig: {
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
        userConfig: {
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
        userConfig: {
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

    const cfg = config as TestCfg
    expect(cfg.externals).toBeDefined()
    expect(cfg.externals).toHaveProperty('vue')
    expect(cfg.externals.vue.root).toBe('Vue')
  })

  it('应使用自定义 fileName', () => {
    const config = createLibraryRspackConfigs(
      createMinimalParams({
        userConfig: {
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
        userConfig: {
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
        userConfig: {
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
        userConfig: {
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
        userConfig: {
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
        userConfig: {
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

  it('没有 library 配置应该抛出错误', () => {
    expect(() =>
      createLibraryRspackConfigs(
        createMinimalParams({ userConfig: undefined }),
      ),
    ).toThrow('library config is required')
  })
})
