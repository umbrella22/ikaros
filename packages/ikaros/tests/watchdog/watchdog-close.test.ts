import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockedChokidar = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => void>()
  const closeSpy = vi.fn().mockResolvedValue(undefined)
  const addSpy = vi.fn()
  const unwatchSpy = vi.fn().mockResolvedValue(undefined)
  const watcher = {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler)
      return watcher
    }),
    add: addSpy,
    unwatch: unwatchSpy,
    close: closeSpy,
  }
  const watchSpy = vi.fn(() => watcher)

  return {
    addSpy,
    handlers,
    closeSpy,
    unwatchSpy,
    watcher,
    watchSpy,
  }
})

const mockedLogger = vi.hoisted(() => ({
  done: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  okay: vi.fn(),
  warning: vi.fn(),
}))

vi.mock('chokidar', () => ({
  default: {
    watch: mockedChokidar.watchSpy,
  },
}))

vi.mock('../../src/node/shared/logger', () => ({
  logger: mockedLogger,
}))

import { createWatchdog } from '../../src/node/watchdog/watchdog'

describe('Watchdog close boundary', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockedChokidar.handlers.clear()
    mockedChokidar.closeSpy.mockClear()
    mockedChokidar.addSpy.mockClear()
    mockedChokidar.unwatchSpy.mockClear()
    mockedChokidar.watchSpy.mockClear()
    mockedChokidar.watcher.on.mockClear()
    mockedLogger.done.mockClear()
    mockedLogger.error.mockClear()
    mockedLogger.info.mockClear()
    mockedLogger.okay.mockClear()
    mockedLogger.warning.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('close 后不应再执行挂起的尾部重启', async () => {
    let resolveRestart: (() => void) | undefined
    const onRestart = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveRestart = resolve
        }),
    )

    const watchdog = createWatchdog({
      context: '/test/project',
      onRestart,
      debounceMs: 100,
    })

    mockedChokidar.handlers.get('change')?.('/test/project/ikaros.config.mjs')
    await vi.advanceTimersByTimeAsync(100)

    expect(onRestart).toHaveBeenCalledTimes(1)

    mockedChokidar.handlers.get('change')?.('/test/project/env/.env')
    await Promise.resolve()

    await watchdog.close()
    resolveRestart?.()
    await Promise.resolve()
    await vi.runAllTimersAsync()

    expect(mockedChokidar.closeSpy).toHaveBeenCalledTimes(1)
    expect(onRestart).toHaveBeenCalledTimes(1)
  })

  it('应使用归一化后的 chokidar 默认选项', async () => {
    createWatchdog({
      context: '/test/project',
      onRestart: vi.fn().mockResolvedValue(undefined),
      debounceMs: 100,
    })

    expect(mockedChokidar.watchSpy).toHaveBeenCalledTimes(1)
    expect(mockedChokidar.watchSpy).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        ignoreInitial: true,
        ignorePermissionErrors: true,
        awaitWriteFinish: {
          stabilityThreshold: 200,
          pollInterval: 50,
        },
      }),
    )
  })

  it('ready 事件重复触发时只打印一次就绪日志', async () => {
    const watchdog = createWatchdog({
      context: '/test/project',
      onRestart: vi.fn().mockResolvedValue(undefined),
      debounceMs: 100,
    })

    mockedChokidar.handlers.get('ready')?.()
    mockedChokidar.handlers.get('ready')?.()

    const readyLogCalls = mockedLogger.info.mock.calls.filter(
      ([payload]) =>
        payload.text === '看门狗已就绪，正在监听配置文件和环境变量变更...',
    )

    expect(readyLogCalls).toHaveLength(1)

    await watchdog.close()
  })
})
