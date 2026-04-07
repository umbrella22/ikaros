import { describe, it, expect, vi } from 'vitest'
import { createCleanupRegistry } from '../../src/node/watchdog/cleanup-registry'

describe('CleanupRegistry', () => {
  it('应按注册顺序执行所有清理函数', async () => {
    const registry = createCleanupRegistry()
    const order: number[] = []
    registry.register(() => {
      order.push(1)
    })
    registry.register(() => {
      order.push(2)
    })
    registry.register(async () => {
      order.push(3)
    })

    await registry.run()

    expect(order).toEqual([1, 2, 3])
  })

  it('执行后应清空注册表', async () => {
    const registry = createCleanupRegistry()
    const fn = vi.fn()
    registry.register(fn)

    await registry.run()
    expect(fn).toHaveBeenCalledOnce()

    // 再次执行不应调用任何函数
    fn.mockReset()
    await registry.run()
    expect(fn).not.toHaveBeenCalled()
  })

  it('某个清理函数抛出异常不应影响其他清理函数执行', async () => {
    const registry = createCleanupRegistry()
    const fn1 = vi.fn()
    const fn2 = vi.fn()

    registry.register(fn1)
    registry.register(() => {
      throw new Error('cleanup error')
    })
    registry.register(fn2)

    // 所有清理函数都应执行，但最终应抛出聚合错误
    await expect(registry.run()).rejects.toThrow('1 cleanup(s) failed')

    expect(fn1).toHaveBeenCalledOnce()
    expect(fn2).toHaveBeenCalledOnce()
  })

  it('无注册函数时 runCleanups 应安全执行', async () => {
    const registry = createCleanupRegistry()

    await expect(registry.run()).resolves.toBeUndefined()
  })
})
