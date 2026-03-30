import { afterEach, describe, expect, it, vi } from 'vitest'

const viteMocks = vi.hoisted(() => {
  const closeSpy = vi.fn(async () => undefined)
  const printUrlsSpy = vi.fn()
  const listenSpy = vi.fn(async () => undefined)
  const createServerSpy = vi.fn(async () => ({
    listen: listenSpy,
    close: closeSpy,
    printUrls: printUrlsSpy,
    config: {
      server: {
        port: 4173,
      },
    },
  }))

  return {
    closeSpy,
    printUrlsSpy,
    listenSpy,
    createServerSpy,
  }
})

vi.mock('vite', () => ({
  build: vi.fn(),
  createServer: viteMocks.createServerSpy,
}))

import { startViteDevServer } from '../src/runner/vite-runner'

describe('startViteDevServer', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('应注册 cleanup 并在执行时关闭 server', async () => {
    const cleanups: Array<() => Promise<void> | void> = []

    await startViteDevServer(
      {
        root: '/test/project',
      },
      {
        port: 4173,
        registerCleanup: (cleanup) => {
          cleanups.push(cleanup)
        },
      },
    )

    expect(viteMocks.createServerSpy).toHaveBeenCalledOnce()
    expect(cleanups).toHaveLength(1)

    await cleanups[0]()

    expect(viteMocks.closeSpy).toHaveBeenCalledOnce()
  })
})
