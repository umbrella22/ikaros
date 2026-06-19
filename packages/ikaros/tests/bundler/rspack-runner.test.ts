import { afterEach, describe, expect, it, vi } from 'vitest'

const closeSpy = vi.fn((callback?: (err?: Error) => void) => callback?.())
const watchCallbacks: Array<(err: Error | null, stats?: unknown) => void> = []
const watchSpy = vi.fn((_options, callback) => {
  watchCallbacks.push(callback)
  return {
    close: closeSpy,
  }
})

vi.mock('@rspack/core', () => ({
  rspack: vi.fn(() => ({
    watch: watchSpy,
  })),
}))

import { watchRspackBuild } from '../../src/node/bundler/rspack/rspack-runner'
import { createCleanupRegistry } from '../../src/node/watchdog/cleanup-registry'

describe('watchRspackBuild', () => {
  afterEach(async () => {
    vi.clearAllMocks()
    watchCallbacks.length = 0
    closeSpy.mockImplementation((callback?: (err?: Error) => void) =>
      callback?.(),
    )
  })

  it('应注册 cleanup 并在清理时关闭 watching', async () => {
    const cleanupRegistry = createCleanupRegistry()

    const promise = watchRspackBuild({} as never, {
      registerCleanup: cleanupRegistry.register,
    })

    watchCallbacks[0](null, {
      hasErrors: () => false,
      toString: () => 'watch ok',
    })

    await expect(promise).resolves.toBe('watch ok')

    await cleanupRegistry.run()

    expect(watchSpy).toHaveBeenCalledOnce()
    expect(closeSpy).toHaveBeenCalledOnce()
  })

  it('首次 watch 失败时应 reject 并关闭 watching', async () => {
    const error = new Error('first build failed')
    const onBuildStatus = vi.fn()

    const promise = watchRspackBuild({} as never, {
      onBuildStatus,
    })

    watchCallbacks[0](error)

    await expect(promise).rejects.toThrow('first build failed')
    expect(closeSpy).toHaveBeenCalledOnce()
    expect(onBuildStatus).toHaveBeenCalledWith({
      success: false,
      message: 'first build failed',
    })
  })

  it('首次成功后的增量失败只应上报状态，不应重复关闭 watching', async () => {
    const onBuildStatus = vi.fn()
    const promise = watchRspackBuild({} as never, {
      onBuildStatus,
    })

    watchCallbacks[0](null, {
      hasErrors: () => false,
      toString: () => 'first ok',
    })

    await expect(promise).resolves.toBe('first ok')

    watchCallbacks[0](new Error('incremental failed'))

    expect(closeSpy).not.toHaveBeenCalled()
    expect(onBuildStatus).toHaveBeenLastCalledWith({
      success: false,
      message: 'incremental failed',
    })
  })

  it('首次 stats error 时应 reject 并关闭 watching', async () => {
    const promise = watchRspackBuild({} as never)

    watchCallbacks[0](null, {
      hasErrors: () => true,
      toString: () => 'stats failed',
    })

    await expect(promise).rejects.toThrow('Build failed with errors')
    expect(closeSpy).toHaveBeenCalledOnce()
  })
})
