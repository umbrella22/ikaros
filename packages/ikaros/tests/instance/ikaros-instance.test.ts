import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Command } from '../../src/node/compile/compile-context'

const mocked = vi.hoisted(() => {
  const cleanupSpy = vi.fn(async () => undefined)
  const runCompileMock = vi.fn(async (params) => {
    params.registerCleanup?.(cleanupSpy)
  })
  const inspectConfigMock = vi.fn(async () => ({
    command: Command.BUILD,
    context: '/test/project',
    platform: 'web',
    env: {},
    preWarnings: [],
    rawConfig: {},
    currentConfig: {},
    normalizedConfig: {},
    bundlerConfig: {},
    diagnostics: {
      bundler: 'rspack',
      frameworkPlugins: [],
      hooks: {
        modifyIkarosConfig: [],
        modifyNormalizedConfig: [],
        modifyRspackConfig: [],
        modifyViteConfig: [],
        onBeforeCreateCompiler: [],
        onBeforeBuild: [],
        onAfterBuild: [],
        onCloseBuild: [],
        onBeforeStartDevServer: [],
        onAfterStartDevServer: [],
        onCloseDevServer: [],
      },
      bundlerPluginNames: [],
    },
  }))
  const watchdogCloseMock = vi.fn(async () => undefined)
  const runtimeState: {
    restartRuntime?: () => Promise<void>
  } = {}

  const createWatchdogMock = vi.fn((options) => {
    runtimeState.restartRuntime = async () => {
      await options.onRestart({
        file: '/tmp/ikaros.config.mjs',
        event: 'change',
      })
    }

    return {
      close: watchdogCloseMock,
    }
  })

  return {
    cleanupSpy,
    runCompileMock,
    inspectConfigMock,
    watchdogCloseMock,
    runtimeState,
    createWatchdogMock,
  }
})

vi.mock('../../src/node/compile/compile-pipeline', () => ({
  runCompile: mocked.runCompileMock,
}))

vi.mock('../../src/node/inspect/inspect-config', () => ({
  inspectConfig: mocked.inspectConfigMock,
}))

vi.mock('../../src/node/watchdog/watchdog', () => ({
  createWatchdog: mocked.createWatchdogMock,
}))

import { createIkaros } from '../../src/node/core/create-ikaros'

describe('IkarosInstance', () => {
  beforeEach(() => {
    mocked.cleanupSpy.mockClear()
    mocked.runCompileMock.mockClear()
    mocked.inspectConfigMock.mockClear()
    mocked.watchdogCloseMock.mockClear()
    mocked.createWatchdogMock.mockClear()
    mocked.runtimeState.restartRuntime = undefined
  })

  it('dev 应通过实例级 cleanup 完成重启与关闭', async () => {
    const ikaros = await createIkaros({
      options: {
        platform: 'web',
      },
    })

    await ikaros.dev()

    expect(mocked.runCompileMock).toHaveBeenCalledTimes(1)
    expect(mocked.runCompileMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ command: Command.SERVER }),
    )
    expect(mocked.createWatchdogMock).toHaveBeenCalledTimes(1)

    await mocked.runtimeState.restartRuntime?.()

    expect(mocked.cleanupSpy).toHaveBeenCalledTimes(1)
    expect(mocked.runCompileMock).toHaveBeenCalledTimes(2)
    expect(mocked.runCompileMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ command: Command.SERVER }),
    )

    await ikaros.close()

    expect(mocked.watchdogCloseMock).toHaveBeenCalledTimes(1)
    expect(mocked.cleanupSpy).toHaveBeenCalledTimes(2)
  })

  it('build 应只执行一次构建且不启动看门狗', async () => {
    const ikaros = await createIkaros({
      options: {
        platform: 'web',
      },
    })

    await ikaros.build()

    expect(mocked.runCompileMock).toHaveBeenCalledTimes(1)
    expect(mocked.runCompileMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ command: Command.BUILD }),
    )
    expect(mocked.createWatchdogMock).not.toHaveBeenCalled()
    expect(mocked.cleanupSpy).not.toHaveBeenCalled()
  })

  it('inspectConfig 应复用实例选项并委托 inspect pipeline', async () => {
    const ikaros = await createIkaros({
      options: {
        mode: 'production',
        platform: 'web',
      },
      context: '/workspace/demo',
      configFile: 'custom.config.mjs',
    })

    const result = await ikaros.inspectConfig({
      command: Command.SERVER,
      writeToDisk: true,
      outputFile: 'inspect.json',
    })

    expect(mocked.inspectConfigMock).toHaveBeenCalledWith({
      command: Command.SERVER,
      writeToDisk: true,
      outputFile: 'inspect.json',
      options: {
        mode: 'production',
        platform: 'web',
      },
      context: '/workspace/demo',
      configFile: 'custom.config.mjs',
    })
    expect(result.command).toBe(Command.BUILD)
  })
})
