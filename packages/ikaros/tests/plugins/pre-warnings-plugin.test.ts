import { describe, it, expect, vi } from 'vitest'
import { PreWarningsPlugin } from '../../src/node/plugins/pre-warnings-plugin'

describe('PreWarningsPlugin', () => {
  const createMockCompiler = () => {
    const warnFn = vi.fn()
    const loggerMap = new Map<string, { warn: typeof warnFn }>()

    const getLogger = (source: string) => {
      if (!loggerMap.has(source)) {
        loggerMap.set(source, { warn: vi.fn() })
      }
      return loggerMap.get(source)!
    }

    const tapCallback = vi.fn()
    const compiler = {
      hooks: {
        thisCompilation: {
          tap: vi.fn((_name: string, cb: (compilation: unknown) => void) => {
            tapCallback.mockImplementation(cb)
          }),
        },
      },
    }

    return { compiler, tapCallback, getLogger, loggerMap }
  }

  it('应在 compilation 时注入警告到对应的 logger', () => {
    const warnings = [
      { source: 'env-loader', message: 'env folder not found' },
      { source: 'config', message: 'missing field' },
    ]
    const plugin = new PreWarningsPlugin(warnings)
    const { compiler, tapCallback, getLogger, loggerMap } = createMockCompiler()

    plugin.apply(compiler as never)

    // 触发 thisCompilation 回调
    expect(compiler.hooks.thisCompilation.tap).toHaveBeenCalledOnce()
    tapCallback({ getLogger })

    expect(loggerMap.get('env-loader')!.warn).toHaveBeenCalledWith(
      'env folder not found',
    )
    expect(loggerMap.get('config')!.warn).toHaveBeenCalledWith('missing field')
  })

  it('quiet 模式下不应注册 hook', () => {
    const plugin = new PreWarningsPlugin(
      [{ source: 'test', message: 'msg' }],
      true,
    )
    const { compiler } = createMockCompiler()

    plugin.apply(compiler as never)

    expect(compiler.hooks.thisCompilation.tap).not.toHaveBeenCalled()
  })

  it('无警告时不应注册 hook', () => {
    const plugin = new PreWarningsPlugin([])
    const { compiler } = createMockCompiler()

    plugin.apply(compiler as never)

    expect(compiler.hooks.thisCompilation.tap).not.toHaveBeenCalled()
  })
})
