import { describe, it, expect } from 'vitest'
import { configSchema } from '../../src/node/config/config-schema'

describe('configSchema', () => {
  // ─── 有效配置 ──────────────────────────────────────────────────────────

  it('应接受最小的 rspack 配置', () => {
    const result = configSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('应接受显式指定 bundler 为 rspack', () => {
    const result = configSchema.safeParse({ bundler: 'rspack' })
    expect(result.success).toBe(true)
  })

  it('应接受 vite 配置', () => {
    const result = configSchema.safeParse({ bundler: 'vite' })
    expect(result.success).toBe(true)
  })

  it('应接受完整的 rspack 配置', () => {
    const result = configSchema.safeParse({
      bundler: 'rspack',
      target: 'mobile',
      quiet: true,
      build: {
        sourceMap: true,
        gzip: true,
        outDirName: 'output',
        outReport: false,
        cache: true,
        dependencyCycleCheck: true,
      },
      resolve: {
        alias: { '@': './src' },
        extensions: ['.ts', '.tsx'],
      },
      server: {
        port: 3000,
      },
    })
    expect(result.success).toBe(true)
  })

  // ─── Library 配置 ──────────────────────────────────────────────────────

  it('应接受字符串形式的 library entry', () => {
    const result = configSchema.safeParse({
      library: { entry: 'src/index.ts' },
    })
    expect(result.success).toBe(true)
  })

  it('应接受数组形式的 library entry', () => {
    const result = configSchema.safeParse({
      library: { entry: ['src/index.ts', 'src/utils.ts'] },
    })
    expect(result.success).toBe(true)
  })

  it('应接受对象形式的 library entry', () => {
    const result = configSchema.safeParse({
      library: { entry: { main: 'src/index.ts', utils: 'src/utils.ts' } },
    })
    expect(result.success).toBe(true)
  })

  it('umd 格式必须指定 name', () => {
    const result = configSchema.safeParse({
      library: {
        entry: 'src/index.ts',
        formats: ['umd'],
      },
    })
    expect(result.success).toBe(false)
  })

  it('iife 格式必须指定 name', () => {
    const result = configSchema.safeParse({
      library: {
        entry: 'src/index.ts',
        formats: ['iife'],
      },
    })
    expect(result.success).toBe(false)
  })

  it('umd 格式指定 name 后应通过验证', () => {
    const result = configSchema.safeParse({
      library: {
        entry: 'src/index.ts',
        formats: ['umd'],
        name: 'MyLib',
      },
    })
    expect(result.success).toBe(true)
  })

  it('es/cjs 格式不需要 name', () => {
    const result = configSchema.safeParse({
      library: {
        entry: 'src/index.ts',
        formats: ['es', 'cjs'],
      },
    })
    expect(result.success).toBe(true)
  })

  // ─── Server 配置 ──────────────────────────────────────────────────────

  it('应拒绝端口号小于 1024', () => {
    const result = configSchema.safeParse({
      server: { port: 80 },
    })
    expect(result.success).toBe(false)
  })

  it('应拒绝端口号大于 65535', () => {
    const result = configSchema.safeParse({
      server: { port: 70000 },
    })
    expect(result.success).toBe(false)
  })

  it('应接受有效端口号', () => {
    const result = configSchema.safeParse({
      server: { port: 8080 },
    })
    expect(result.success).toBe(true)
  })

  // ─── Vite 限制 ─────────────────────────────────────────────────────────

  it('vite 模式下不应允许 rspack-only 字段 plugins', () => {
    const result = configSchema.safeParse({
      bundler: 'vite',
      plugins: [{}],
    })
    expect(result.success).toBe(false)
  })

  it('vite 模式下不应允许 loaders', () => {
    const result = configSchema.safeParse({
      bundler: 'vite',
      loaders: [{}],
    })
    expect(result.success).toBe(false)
  })

  it('vite 模式下不应允许 experiments', () => {
    const result = configSchema.safeParse({
      bundler: 'vite',
      experiments: {},
    })
    expect(result.success).toBe(false)
  })

  it('vite 模式下不应允许 cdnOptions', () => {
    const result = configSchema.safeParse({
      bundler: 'vite',
      cdnOptions: { modules: [] },
    })
    expect(result.success).toBe(false)
  })

  it('vite 模式下允许 vite.plugins', () => {
    const result = configSchema.safeParse({
      bundler: 'vite',
      vite: { plugins: [] },
    })
    expect(result.success).toBe(true)
  })

  // ─── Target ────────────────────────────────────────────────────────────

  it('应接受 pc target', () => {
    const result = configSchema.safeParse({ target: 'pc' })
    expect(result.success).toBe(true)
  })

  it('应接受 mobile target', () => {
    const result = configSchema.safeParse({ target: 'mobile' })
    expect(result.success).toBe(true)
  })

  it('应拒绝无效 target', () => {
    const result = configSchema.safeParse({ target: 'invalid' })
    expect(result.success).toBe(false)
  })
})
