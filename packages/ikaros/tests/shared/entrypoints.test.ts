import { beforeEach, describe, expect, it, vi } from 'vitest'

const entrypointMocks = vi.hoisted(() => {
  const parseSpy = vi.fn()
  const versionSpy = vi.fn()
  const compileCommanderSpy = vi.fn()
  const inspectCommanderSpy = vi.fn()
  const assertNodeVersionSpy = vi.fn()
  const program = {
    parse: parseSpy,
    version: versionSpy,
  }

  versionSpy.mockImplementation(() => program)

  return {
    assertNodeVersionSpy,
    compileCommanderSpy,
    inspectCommanderSpy,
    parseSpy,
    program,
    versionSpy,
  }
})

vi.mock('commander', () => ({
  program: entrypointMocks.program,
}))

vi.mock('../../src/node/compile/index', () => ({
  commander: entrypointMocks.compileCommanderSpy,
}))

vi.mock('../../src/node/inspect', () => ({
  commander: entrypointMocks.inspectCommanderSpy,
}))

vi.mock('../../src/node/shared/check-env', () => ({
  assertNodeVersion: entrypointMocks.assertNodeVersionSpy,
}))

describe('node entrypoints', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    entrypointMocks.versionSpy.mockImplementation(() => entrypointMocks.program)
  })

  it('导入库入口时不应执行 CLI 启动逻辑', async () => {
    await import('../../src/node/index')

    expect(entrypointMocks.assertNodeVersionSpy).not.toHaveBeenCalled()
    expect(entrypointMocks.compileCommanderSpy).not.toHaveBeenCalled()
    expect(entrypointMocks.inspectCommanderSpy).not.toHaveBeenCalled()
    expect(entrypointMocks.parseSpy).not.toHaveBeenCalled()
    expect(entrypointMocks.versionSpy).not.toHaveBeenCalled()
  })

  it('导入 CLI 入口时应执行 CLI 启动逻辑', async () => {
    await import('../../src/node/cli')

    expect(entrypointMocks.assertNodeVersionSpy).toHaveBeenCalledWith(22)
    expect(entrypointMocks.versionSpy).toHaveBeenCalledWith(
      expect.any(String),
      '-v, --version',
    )
    expect(entrypointMocks.compileCommanderSpy).toHaveBeenCalledWith(
      entrypointMocks.program,
    )
    expect(entrypointMocks.inspectCommanderSpy).toHaveBeenCalledWith(
      entrypointMocks.program,
    )
    expect(entrypointMocks.parseSpy).toHaveBeenCalledOnce()
  })
})
