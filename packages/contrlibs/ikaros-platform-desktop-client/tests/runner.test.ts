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

import { resolveForwardArgs, runDesktopClientDev } from '../src/runner'

const loadElectron = <T>(): T => '/mock/electron' as T

describe('runDesktopClientDev', () => {
  const originalArgv = process.argv
  const originalNpmExecPath = process.env.npm_execpath

  beforeEach(() => {
    runnerMocks.reset()
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    process.argv = originalArgv
    if (originalNpmExecPath === undefined) {
      delete process.env.npm_execpath
    } else {
      process.env.npm_execpath = originalNpmExecPath
    }
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('显式 electronArgs 应优先于 package manager 参数推断', () => {
    process.env.npm_execpath = '/usr/local/bin/pnpm.cjs'
    process.argv = ['node', 'pnpm', 'dev', '--', '--from-cli']

    expect(resolveForwardArgs(['--explicit'])).toEqual(['--explicit'])
  })

  it.each([
    ['npm', '/usr/local/lib/node_modules/npm/bin/npm-cli.js'],
    ['pnpm', '/usr/local/bin/pnpm.cjs'],
    ['yarn', '/usr/local/bin/yarn.js'],
  ])('%s 应只透传 -- 后面的参数', (_name, execPath) => {
    process.env.npm_execpath = execPath
    process.argv = ['node', 'pm', 'run', 'dev', '--', '--foo', 'bar']

    expect(resolveForwardArgs()).toEqual(['--foo', 'bar'])
  })

  it('没有 -- 分隔符时不应自动透传 package manager 参数', () => {
    process.env.npm_execpath = '/usr/local/bin/pnpm.cjs'
    process.argv = ['node', 'pm', 'run', 'dev', '--foo', 'bar']

    expect(resolveForwardArgs()).toEqual([])
  })

  it('未知 package manager 不应透传参数', () => {
    process.env.npm_execpath = '/usr/local/bin/custom-pm'
    process.argv = ['node', 'custom-pm', 'dev', '--', '--foo']

    expect(resolveForwardArgs()).toEqual([])
  })

  it('应注册 cleanup 并在执行时关闭子进程与 readline', async () => {
    const cleanups: Array<() => Promise<void> | void> = []
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)

    await runDesktopClientDev({
      entryFile: '/tmp/main.js',
      loadContextModule: loadElectron,
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
      loadContextModule: loadElectron,
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
      loadContextModule: loadElectron,
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

  it('连续重启只应忽略被主动 kill 的旧进程', async () => {
    vi.useFakeTimers()
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never)
    vi.spyOn(process, 'kill').mockImplementation(() => true)
    let mainStatusHandler: ((status: { success: boolean }) => void) | undefined

    await runDesktopClientDev({
      entryFile: '/tmp/main.js',
      loadContextModule: loadElectron,
      startRendererDev: async () => 3000,
      startMainDev: async (options) => {
        mainStatusHandler = options?.onBuildStatus as typeof mainStatusHandler
      },
      startPreloadDev: async () => undefined,
    })

    mainStatusHandler?.({ success: true })
    await vi.advanceTimersByTimeAsync(200)
    mainStatusHandler?.({ success: true })
    await vi.advanceTimersByTimeAsync(200)
    await vi.advanceTimersByTimeAsync(1800)

    runnerMocks.closeHandlers[1](0, null)

    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('重启窗口内新 Electron 进程退出也应被正常处理', async () => {
    vi.useFakeTimers()
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never)
    vi.spyOn(process, 'kill').mockImplementation(() => true)
    let mainStatusHandler: ((status: { success: boolean }) => void) | undefined

    await runDesktopClientDev({
      entryFile: '/tmp/main.js',
      loadContextModule: loadElectron,
      startRendererDev: async () => 3000,
      startMainDev: async (options) => {
        mainStatusHandler = options?.onBuildStatus as typeof mainStatusHandler
      },
      startPreloadDev: async () => undefined,
    })

    mainStatusHandler?.({ success: true })
    await vi.advanceTimersByTimeAsync(200)

    expect(runnerMocks.spawnSpy).toHaveBeenCalledTimes(2)

    runnerMocks.closeHandlers[1](1, null)

    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('首次构建成功后不应立刻触发自重启', async () => {
    vi.useFakeTimers()
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)

    await runDesktopClientDev({
      entryFile: '/tmp/main.js',
      loadContextModule: loadElectron,
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
      loadContextModule: loadElectron,
      startRendererDev: async () => 3000,
      startMainDev: async () => undefined,
      startPreloadDev: async () => undefined,
    })

    runnerMocks.getLineHandler()?.('q')

    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  it('应支持向 Electron 主进程透传额外参数', async () => {
    await runDesktopClientDev({
      entryFile: '/tmp/main.js',
      loadContextModule: loadElectron,
      startRendererDev: async () => 3000,
      startMainDev: async () => undefined,
      startPreloadDev: async () => undefined,
      electronArgs: ['--foo', 'bar'],
    })

    expect(runnerMocks.spawnSpy).toHaveBeenCalledWith(
      '/mock/electron',
      ['--inspect=5858', '/tmp/main.js', '--foo', 'bar'],
      { stdio: ['inherit', 'pipe', 'pipe'] },
    )
  })
})
