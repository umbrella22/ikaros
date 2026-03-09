import { describe, it, expect, vi, afterEach } from 'vitest'
import { assertNodeVersion } from '../../src/node/shared/check-env'

describe('assertNodeVersion', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('当 Node 版本满足要求时不应退出', () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never)

    // 当前 Node 版本肯定 >= 1
    assertNodeVersion(1)
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('当 Node 版本低于要求时应调用 process.exit(1)', () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never)
    const stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true)

    // 要求 v999，肯定不满足
    assertNodeVersion(999)
    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(stderrSpy).toHaveBeenCalled()
  })

  it('错误信息应包含版本要求', () => {
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    const stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true)

    assertNodeVersion(999)

    const output = stderrSpy.mock.calls[0][0] as string
    expect(output).toContain('999')
    expect(output).toContain(process.versions.node)
  })
})
