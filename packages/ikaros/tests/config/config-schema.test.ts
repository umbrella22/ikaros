import { describe, it, expect } from 'vitest'
import { configSchema } from '../../src/node/config/config-schema'

describe('configSchema', () => {
  // ─── 有效配置 ──────────────────────────────────────────────────────────

  it('应接受最小的 rspack 配置', () => {
    const result = configSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('应接受显式指定 bundle.adapter 为 rspack', () => {
    const result = configSchema.safeParse({
      bundle: {
        adapter: 'rspack',
      },
    })
    expect(result.success).toBe(true)
  })

  it('应接受 vite 配置', () => {
    const result = configSchema.safeParse({
      bundle: {
        adapter: 'vite',
      },
    })
    expect(result.success).toBe(true)
  })

  it('应接受完整的 rspack 配置', () => {
    const result = configSchema.safeParse({
      app: {
        target: 'mobile',
      },
      log: {
        level: 'quiet',
      },
      bundle: {
        adapter: 'rspack',
        rspack: {
          plugins: [{}],
          loaders: [{}],
          experiments: {},
          cdn: { modules: [] },
          moduleFederation: {},
          css: {
            lightningcss: { targets: 'defaults' },
            sourceMap: true,
            less: { lessOptions: { math: 'always' } },
            sass: { sassOptions: { api: 'modern-compiler' } },
            stylus: { stylusOptions: { compress: false } },
          },
        },
      },
      output: {
        sourceMap: true,
        gzip: true,
        dir: 'output',
        report: false,
        cache: true,
        checkCycles: true,
      },
      source: {
        alias: { '@': './src' },
        extensions: ['.ts', '.tsx'],
      },
      dev: {
        port: 3000,
      },
    })
    expect(result.success).toBe(true)
  })

  it('应接受顶层框架插件配置', () => {
    const result = configSchema.safeParse({
      plugins: [
        {
          name: 'demo-plugin',
          setup() {},
        },
      ],
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
      dev: { port: 80 },
    })
    expect(result.success).toBe(false)
  })

  it('应拒绝端口号大于 65535', () => {
    const result = configSchema.safeParse({
      dev: { port: 70000 },
    })
    expect(result.success).toBe(false)
  })

  it('应接受有效端口号', () => {
    const result = configSchema.safeParse({
      dev: { port: 8080 },
    })
    expect(result.success).toBe(true)
  })

  // ─── Vite 限制 ─────────────────────────────────────────────────────────

  it('顶层 plugins 不再接受旧的 bundler 插件写法', () => {
    const result = configSchema.safeParse({
      bundle: { adapter: 'rspack' },
      plugins: [{}],
    })
    expect(result.success).toBe(false)
  })

  it('顶层不应再允许旧 loaders 字段', () => {
    const result = configSchema.safeParse({
      bundle: { adapter: 'rspack' },
      loaders: [{}],
    })
    expect(result.success).toBe(false)
  })

  it('顶层不应再允许旧 experiments 字段', () => {
    const result = configSchema.safeParse({
      bundle: { adapter: 'rspack' },
      experiments: {},
    })
    expect(result.success).toBe(false)
  })

  it('顶层不应再允许旧 cdnOptions 字段', () => {
    const result = configSchema.safeParse({
      bundle: { adapter: 'rspack' },
      cdnOptions: { modules: [] },
    })
    expect(result.success).toBe(false)
  })

  it('顶层不应再允许旧 moduleFederation 字段', () => {
    const result = configSchema.safeParse({
      bundle: { adapter: 'rspack' },
      moduleFederation: {},
    })
    expect(result.success).toBe(false)
  })

  it('顶层不应再允许旧 css 字段', () => {
    const result = configSchema.safeParse({
      bundle: { adapter: 'rspack' },
      css: {
        sourceMap: true,
      },
    })
    expect(result.success).toBe(false)
  })

  it('vite 模式下允许 vite.plugins', () => {
    const result = configSchema.safeParse({
      bundle: {
        adapter: 'vite',
        vite: { plugins: [] },
      },
    })
    expect(result.success).toBe(true)
  })

  it('vite 模式下允许原生 config 与显式 configFile 高级出口', () => {
    const result = configSchema.safeParse({
      bundle: {
        adapter: 'vite',
        vite: {
          config: {
            server: {
              hmr: false,
            },
          },
          configFile: './vite.config.ts',
        },
      },
    })

    expect(result.success).toBe(true)
  })

  // ─── Target ────────────────────────────────────────────────────────────

  it('应接受 pc target', () => {
    const result = configSchema.safeParse({ app: { target: 'pc' } })
    expect(result.success).toBe(true)
  })

  it('应接受 mobile target', () => {
    const result = configSchema.safeParse({ app: { target: 'mobile' } })
    expect(result.success).toBe(true)
  })

  it('应拒绝无效 target', () => {
    const result = configSchema.safeParse({ app: { target: 'invalid' } })
    expect(result.success).toBe(false)
  })
})
