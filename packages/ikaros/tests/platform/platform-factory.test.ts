import { describe, it, expect } from 'vitest'
import { createPlatformAdapter } from '../../src/node/platform/platform-factory'

describe('createPlatformAdapter', () => {
  it('应为 "web" 返回 WebPlatformAdapter', () => {
    const adapter = createPlatformAdapter('web')
    expect(adapter.name).toBe('web')
    expect(typeof adapter.resolvePreConfig).toBe('function')
    expect(typeof adapter.compile).toBe('function')
  })

  it('未知平台应 fallback 到 WebPlatformAdapter', () => {
    const adapter = createPlatformAdapter('unknown')
    expect(adapter.name).toBe('web')
  })

  it('应为 "desktopClient" 返回延迟加载的适配器', () => {
    const adapter = createPlatformAdapter('desktopClient')
    expect(adapter.name).toBe('desktopClient')
    expect(typeof adapter.resolvePreConfig).toBe('function')
    expect(typeof adapter.compile).toBe('function')
  })
})
