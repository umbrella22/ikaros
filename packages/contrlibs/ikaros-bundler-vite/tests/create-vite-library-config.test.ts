import { describe, it, expect } from 'vitest'

import type { LibraryOptions } from 'vite'

import { createViteLibraryConfig } from '../src/config/create-vite-library-config'
import { createMinimalParams } from './test-utils'

describe('createViteLibraryConfig', () => {
  it('应该不抛异常', () => {
    expect(() =>
      createViteLibraryConfig(
        createMinimalParams({
          contextPkg: { name: 'my-lib', version: '1.0.0' },
          config: {
            library: {
              entry: 'src/index.ts',
              name: 'MyLib',
            },
          },
        }),
      ),
    ).not.toThrow()
  })

  it('应该设置 build.lib', () => {
    const config = createViteLibraryConfig(
      createMinimalParams({
        contextPkg: { name: 'my-lib', version: '1.0.0' },
        config: {
          library: {
            entry: 'src/index.ts',
            name: 'MyLib',
          },
        },
      }),
    )

    expect(config.build?.lib).toBeDefined()
    expect((config.build?.lib as LibraryOptions)?.name).toBe('MyLib')
    expect((config.build?.lib as LibraryOptions)?.entry).toBe(
      '/test/project/src/index.ts',
    )
  })

  it('单入口默认 formats 应为 es + umd', () => {
    const config = createViteLibraryConfig(
      createMinimalParams({
        config: {
          library: {
            entry: 'src/index.ts',
            name: 'MyLib',
          },
        },
      }),
    )

    const lib = config.build?.lib as LibraryOptions
    expect(lib.formats).toEqual(['es', 'umd'])
  })

  it('多入口默认 formats 应为 es + cjs', () => {
    const config = createViteLibraryConfig(
      createMinimalParams({
        config: {
          library: {
            entry: { main: 'src/index.ts', utils: 'src/utils.ts' },
          },
        },
      }),
    )

    const lib = config.build?.lib as LibraryOptions
    expect(lib.formats).toEqual(['es', 'cjs'])
  })

  it('应支持自定义 formats', () => {
    const config = createViteLibraryConfig(
      createMinimalParams({
        config: {
          library: {
            entry: 'src/index.ts',
            name: 'MyLib',
            formats: ['es', 'cjs', 'umd'],
          },
        },
      }),
    )

    const lib = config.build?.lib as LibraryOptions
    expect(lib.formats).toEqual(['es', 'cjs', 'umd'])
  })

  it('应处理 externals', () => {
    const config = createViteLibraryConfig(
      createMinimalParams({
        config: {
          library: {
            entry: 'src/index.ts',
            externals: ['vue', 'react'],
          },
        },
      }),
    )

    expect(config.build?.rollupOptions?.external).toEqual(['vue', 'react'])
  })

  it('应处理 globals', () => {
    const config = createViteLibraryConfig(
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

    const output = config.build?.rollupOptions?.output as {
      globals?: Record<string, string>
    }
    expect(output?.globals).toEqual({ vue: 'Vue' })
  })

  it('应使用自定义 fileName', () => {
    const config = createViteLibraryConfig(
      createMinimalParams({
        config: {
          library: {
            entry: 'src/index.ts',
            fileName: 'my-custom-lib',
          },
        },
      }),
    )

    const lib = config.build?.lib as LibraryOptions
    expect(lib.fileName).toBe('my-custom-lib')
  })

  it('应使用 fileName 函数', () => {
    const fileNameFn = (format: string, entryName: string) =>
      `${entryName}.${format}.js`

    const config = createViteLibraryConfig(
      createMinimalParams({
        config: {
          library: {
            entry: 'src/index.ts',
            fileName: fileNameFn,
          },
        },
      }),
    )

    const lib = config.build?.lib as LibraryOptions
    expect(typeof lib.fileName).toBe('function')
  })

  it('应设置 cssFileName', () => {
    const config = createViteLibraryConfig(
      createMinimalParams({
        config: {
          library: {
            entry: 'src/index.ts',
            cssFileName: 'my-lib-style',
          },
        },
      }),
    )

    const lib = config.build?.lib as LibraryOptions
    expect(lib.cssFileName).toBe('my-lib-style')
  })

  it('应正确解析多入口 entry', () => {
    const config = createViteLibraryConfig(
      createMinimalParams({
        config: {
          library: {
            entry: { main: 'src/index.ts', utils: 'src/utils.ts' },
          },
        },
      }),
    )

    const lib = config.build?.lib as LibraryOptions
    expect(lib.entry).toEqual({
      main: '/test/project/src/index.ts',
      utils: '/test/project/src/utils.ts',
    })
  })

  it('应保留 resolve.alias 配置', () => {
    const config = createViteLibraryConfig(
      createMinimalParams({
        config: {
          library: { entry: 'src/index.ts' },
          resolve: { alias: { '~': '/custom/path' } },
        },
      }),
    )

    expect(config.resolve?.alias).toHaveProperty('@', '/test/project/src')
    expect(config.resolve?.alias).toHaveProperty('~', '/custom/path')
  })

  it('应使用自定义 outDirName', () => {
    const config = createViteLibraryConfig(
      createMinimalParams({
        config: {
          library: { entry: 'src/index.ts' },
          build: { outDirName: 'output' },
        },
      }),
    )

    expect(config.build?.outDir).toBe('/test/project/output')
  })

  it('应设置 sourcemap', () => {
    const config = createViteLibraryConfig(
      createMinimalParams({
        config: {
          library: { entry: 'src/index.ts' },
          build: { sourceMap: true },
        },
      }),
    )

    expect(config.build?.sourcemap).toBe(true)
  })

  it('应正确处理 define', () => {
    const config = createViteLibraryConfig(
      createMinimalParams({
        config: {
          library: { entry: 'src/index.ts' },
          define: { __VERSION__: '1.0.0' },
        },
      }),
    )

    expect(config.define).toBeDefined()
    expect(config.define?.__VERSION__).toBe('"1.0.0"')
  })

  it('没有 library 配置应该抛出错误', () => {
    expect(() =>
      createViteLibraryConfig(
        createMinimalParams({
          config: {
            library: null,
          },
        }),
      ),
    ).toThrow('library config is required')
  })
})
