import { describe, expect, it } from 'vitest'

import { migrateConfigSource } from '../../src/node/config/migrate-config'

describe('migrateConfigSource', () => {
  it('应把常见 v2 顶层字段迁移为 v3 语义配置', () => {
    const result = migrateConfigSource(
      `
import { defineConfig } from '@ikaros-cli/ikaros'

export default defineConfig({
  target: 'mobile',
  quiet: true,
  bundler: 'vite',
  define: { __DEV__: false },
  resolve: { alias: { '@': './src' }, extensions: ['.ts'] },
  enablePages: ['index'],
  server: { port: 3001 },
  build: { base: '/app/', outDirName: 'build', outReport: true, dependencyCycleCheck: true },
  rspack: { cdnOptions: { modules: [] } },
  vite: { plugins: [] },
  pages: {},
})
`,
      'ikaros.config.ts',
    )

    expect(result.changed).toBe(true)
    expect(result.code).toContain("app: { target: 'mobile' }")
    expect(result.code).toContain("log: { level: 'quiet' }")
    expect(result.code).toContain("bundle: { adapter: 'vite'")
    expect(result.code).toContain('cdn: { modules: [] }')
    expect(result.code).toContain(
      "source: { define: { __DEV__: false }, alias: { '@': './src' }, extensions: ['.ts'] }",
    )
    expect(result.code).toContain("dev: { port: 3001, pages: ['index'] }")
    expect(result.code).toContain(
      "output: { base: '/app/', dir: 'build', report: true, checkCycles: true }",
    )
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'info',
        }),
      ]),
    )
  })

  it('遇到无法静态迁移的默认导出时应给出诊断并保持源码', () => {
    const source = 'export default createConfigFromEnv(process.env.MODE)'
    const result = migrateConfigSource(source, 'ikaros.config.ts')

    expect(result.changed).toBe(false)
    expect(result.code).toBe(source)
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'warning',
          message: expect.stringContaining('无法自动迁移'),
        }),
      ]),
    )
  })

  it('迁移 build 对象时不应按逗号字符串拆分复杂值', () => {
    const result = migrateConfigSource(
      `
export default defineConfig({
  build: {
    outDirName: 'build',
    assetsDir: 'assets, with comma',
    formats: ['es', 'cjs'],
    nested: { label: 'a, b' },
  },
})
`,
      'ikaros.config.ts',
    )

    expect(result.changed).toBe(true)
    expect(result.code).toContain("dir: 'build'")
    expect(result.code).toContain("assetsDir: 'assets, with comma'")
    expect(result.code).toContain("formats: ['es', 'cjs']")
    expect(result.code).toContain("nested: { label: 'a, b' }")
  })

  it('迁移 build 对象时应诊断 spread 和计算属性并保留可识别字段', () => {
    const result = migrateConfigSource(
      `
const extra = {}
const key = 'cache'
export default defineConfig({
  build: {
    outReport: true,
    ...extra,
    [key]: true,
  },
})
`,
      'ikaros.config.ts',
    )

    expect(result.changed).toBe(true)
    expect(result.code).toContain('output: { report: true }')
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'warning',
          message: expect.stringContaining('spread'),
        }),
        expect.objectContaining({
          level: 'warning',
          message: expect.stringContaining('计算属性名'),
        }),
      ]),
    )
  })
})
