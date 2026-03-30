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

import { runCleanups } from '../../src/node/watchdog/cleanup-registry'
import { watchRspackBuild } from '../../src/node/bundler/rspack/rspack-runner'

describe('watchRspackBuild', () => {
  afterEach(async () => {
    await runCleanups()
    vi.clearAllMocks()
  })

  it('应注册 cleanup 并在清理时关闭 watching', async () => {
    await expect(watchRspackBuild({} as never)).resolves.toBe('watch ok')

    await runCleanups()

    expect(watchSpy).toHaveBeenCalledOnce()
    expect(closeSpy).toHaveBeenCalledOnce()
  })
})
