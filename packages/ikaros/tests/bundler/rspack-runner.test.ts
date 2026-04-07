import { afterEach, describe, expect, it, vi } from 'vitest'

const closeSpy = vi.fn((callback?: (err?: Error) => void) => callback?.())
const watchSpy = vi.fn((options, callback) => {
  callback(null, {
    hasErrors: () => false,
    toString: () => 'watch ok',
  })
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
  })

  it('应注册 cleanup 并在清理时关闭 watching', async () => {
    const cleanupRegistry = createCleanupRegistry()

    await expect(
      watchRspackBuild({} as never, {
        registerCleanup: cleanupRegistry.register,
      }),
    ).resolves.toBe('watch ok')

    await cleanupRegistry.run()

    expect(watchSpy).toHaveBeenCalledOnce()
    expect(closeSpy).toHaveBeenCalledOnce()
  })
})
