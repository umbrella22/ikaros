import { describe, it, expect } from 'vitest'
import { createBundlerAdapter } from '../../src/node/bundler/bundler-factory'
import { RspackAdapter } from '../../src/node/bundler/rspack'

// 简单 mock —— ViteAdapterLoader 需要 loadContextModule，我们只验证工厂逻辑
function mockLoadContextModule<T>(id: string): T {
  throw new Error(`mock: module "${id}" not found`)
}

function mockResolveContextModule(): string | undefined {
  return undefined
}

describe('BundlerFactory', () => {
  it('应为 "rspack" 返回 RspackAdapter 实例', () => {
    const adapter = createBundlerAdapter({
      bundler: 'rspack',
      loadContextModule: mockLoadContextModule,
      resolveContextModule: mockResolveContextModule,
    })

    expect(adapter).toBeInstanceOf(RspackAdapter)
    expect(adapter.name).toBe('rspack')
  })

  it('应为 "vite" 返回 ViteAdapterLoader 实例', () => {
    const adapter = createBundlerAdapter({
      bundler: 'vite',
      loadContextModule: mockLoadContextModule,
      resolveContextModule: mockResolveContextModule,
    })

    expect(adapter.name).toBe('vite')
    // ViteAdapterLoader 是懒加载的，此时不应抛异常
    expect(typeof adapter.createConfig).toBe('function')
    expect(typeof adapter.runDev).toBe('function')
    expect(typeof adapter.runBuild).toBe('function')
  })

  it('未知 bundler 应 fallback 到 rspack', () => {
    const adapter = createBundlerAdapter({
      bundler: 'unknown-bundler' as unknown as 'rspack',
      loadContextModule: mockLoadContextModule,
      resolveContextModule: mockResolveContextModule,
    })

    expect(adapter).toBeInstanceOf(RspackAdapter)
    expect(adapter.name).toBe('rspack')
  })
})
