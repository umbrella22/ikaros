import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runnerMocks = vi.hoisted(() => {
  let lineHandler: ((input: string) => void) | undefined
  const closeHandlers: Array<
    (code: number | null, signal: NodeJS.Signals | null) => void
  > = []
  const children: Array<{
    pid: number
    exitCode: number | null
    stdout: { on: ReturnType<typeof vi.fn> }
    stderr: { on: ReturnType<typeof vi.fn> }
    on: ReturnType<typeof vi.fn>
  }> = []

  const rl = {
    on: vi.fn((event: string, handler: (input: string) => void) => {
      if (event === 'line') {
        lineHandler = handler
      }
      return rl
    }),
    close: vi.fn(),
  }

  const createInterfaceSpy = vi.fn(() => rl)

  const spawnSpy = vi.fn(() => {
    const child = {
      pid: 1000 + children.length,
      exitCode: 0,
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn(
        (
          event: string,
          handler: (code: number | null, signal: NodeJS.Signals | null) => void,
        ) => {
          if (event === 'close') {
            closeHandlers.push(handler)
          }
          return child
        },
      ),
    }

    children.push(child)
    return child
  })

  return {
    rl,
    createInterfaceSpy,
    spawnSpy,
    closeHandlers,
    children,
    getLineHandler: () => lineHandler,
    reset: () => {
      lineHandler = undefined
      closeHandlers.length = 0
      children.length = 0
      rl.on.mockClear()
      rl.close.mockClear()
      createInterfaceSpy.mockClear()
      spawnSpy.mockClear()
    },
  }
})

vi.mock('node:readline', () => ({
  default: {
    createInterface: runnerMocks.createInterfaceSpy,
  },
}))

vi.mock('node:child_process', () => ({
  spawn: runnerMocks.spawnSpy,
}))

import { runDesktopClientDev } from '../src/runner'

describe('runDesktopClientDev', () => {
  beforeEach(() => {
    runnerMocks.reset()
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('应注册 cleanup 并在执行时关闭子进程与 readline', async () => {
    const cleanups: Array<() => Promise<void> | void> = []
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)

    await runDesktopClientDev({
      entryFile: '/tmp/main.js',
      loadContextModule: () => '/mock/electron',
      registerCleanup: (cleanup) => cleanups.push(cleanup),
      startRendererDev: async () => 3000,
      startMainDev: async () => undefined,
      startPreloadDev: async () => undefined,
    })

    expect(cleanups).toHaveLength(1)
    expect(runnerMocks.spawnSpy).toHaveBeenCalledOnce()
    expect(runnerMocks.createInterfaceSpy).toHaveBeenCalledOnce()

    await cleanups[0]()

    expect(killSpy).toHaveBeenCalledWith(1000)
    expect(runnerMocks.rl.close).toHaveBeenCalledOnce()
  })

  it('Electron 正常退出时应结束整个开发进程', async () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never)

    await runDesktopClientDev({
      entryFile: '/tmp/main.js',
      loadContextModule: () => '/mock/electron',
      startRendererDev: async () => 3000,
      startMainDev: async () => undefined,
      startPreloadDev: async () => undefined,
    })

    runnerMocks.closeHandlers[0](0, null)

    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  it('代码保存触发重启时不应结束父进程，且应重新拉起 Electron', async () => {
    vi.useFakeTimers()
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never)
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)
    let mainStatusHandler: ((status: { success: boolean }) => void) | undefined

    await runDesktopClientDev({
      entryFile: '/tmp/main.js',
      loadContextModule: () => '/mock/electron',
      startRendererDev: async () => 3000,
      startMainDev: async (options) => {
        mainStatusHandler = options?.onBuildStatus as typeof mainStatusHandler
      },
      startPreloadDev: async () => undefined,
    })

    mainStatusHandler?.({ success: true })
    await vi.advanceTimersByTimeAsync(200)

    expect(killSpy).toHaveBeenCalledWith(1000)
    expect(runnerMocks.spawnSpy).toHaveBeenCalledTimes(2)

    runnerMocks.closeHandlers[0](0, null)

    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('首次构建成功后不应立刻触发自重启', async () => {
    vi.useFakeTimers()
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)

    await runDesktopClientDev({
      entryFile: '/tmp/main.js',
      loadContextModule: () => '/mock/electron',
      startRendererDev: async () => 3000,
      startMainDev: async (options) => {
        options?.onBuildStatus?.({ success: true })
      },
      startPreloadDev: async (options) => {
        options?.onBuildStatus?.({ success: true })
      },
    })

    await vi.advanceTimersByTimeAsync(200)

    expect(killSpy).not.toHaveBeenCalledWith(1000)
    expect(runnerMocks.spawnSpy).toHaveBeenCalledOnce()
  })

  it('输入 q 时应主动退出整个开发进程', async () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never)
    vi.spyOn(process, 'kill').mockImplementation(() => true)

    await runDesktopClientDev({
      entryFile: '/tmp/main.js',
      loadContextModule: () => '/mock/electron',
      startRendererDev: async () => 3000,
      startMainDev: async () => undefined,
      startPreloadDev: async () => undefined,
    })

    runnerMocks.getLineHandler()?.('q')

    expect(exitSpy).toHaveBeenCalledWith(0)
  })
})
