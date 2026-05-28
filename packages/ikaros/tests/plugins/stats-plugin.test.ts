import { beforeEach, describe, expect, it, vi } from 'vitest'

const cursorMock = vi.hoisted(() => ({
  hide: vi.fn(),
  show: vi.fn(),
}))

vi.mock('cli-cursor', () => ({
  default: cursorMock,
}))

import StatsPlugin from '../../src/node/plugins/stats-plugin'

describe('StatsPlugin', () => {
  beforeEach(() => {
    cursorMock.hide.mockClear()
    cursorMock.show.mockClear()
  })

  it('开启 gzip 时应兼容缺少 gzipped 关联资源的产物', () => {
    const plugin = new StatsPlugin({
      build: {
        gzip: true,
      },
    } as never)

    const stats = {
      assets: [
        {
          name: 'assets/js/app.js',
          size: 1024,
          related: [],
          info: {},
        },
        {
          name: 'assets/css/app.css',
          size: 512,
          related: [{ type: 'gzipped', size: 128 }],
          info: {},
        },
      ],
    } as unknown

    const getTableInfo = (
      plugin as unknown as {
        getTableInfo: (input: unknown) => string | undefined
      }
    ).getTableInfo.bind(plugin)
    const table = getTableInfo(stats)

    expect(table).toContain('assets/js/app.js')
    expect(table).toContain('assets/css/app.css')
    expect(table).toContain('128 B')
  })

  it('compiler 关闭时应恢复终端光标', () => {
    const shutdownTap = vi.fn()
    const compiler = {
      options: {
        mode: 'development',
        devServer: {
          port: 3000,
        },
      },
      hooks: {
        environment: { intercept: vi.fn() },
        watchRun: { intercept: vi.fn() },
        done: { intercept: vi.fn() },
      },
      cache: {
        hooks: {
          shutdown: { tap: shutdownTap },
        },
      },
      __internal__registerBuiltinPlugin: vi.fn(),
    } as never

    new StatsPlugin().apply(compiler)
    const restoreCursor = shutdownTap.mock.calls[0][1]
    restoreCursor()

    expect(cursorMock.hide).toHaveBeenCalledTimes(1)
    expect(cursorMock.show).toHaveBeenCalledTimes(1)
  })
})
