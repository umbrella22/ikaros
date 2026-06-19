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

  it('资源表格应按非 development assets 统计文件数和体积', () => {
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
          related: [{ type: 'gzipped', size: 256 }],
          info: {},
        },
        {
          name: 'assets/js/hot-update.js',
          size: 2048,
          related: [{ type: 'gzipped', size: 512 }],
          info: { development: true },
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
    expect(table).not.toContain('assets/js/hot-update.js')
    expect(table).toContain('There are 1 files')
    expect(table).toContain('1.02 kB')
    expect(table).toContain('256 B')
    expect(table).not.toContain('3.07 kB')
  })

  it('资源表格全部为 development assets 时应不输出', () => {
    const plugin = new StatsPlugin()
    const stats = {
      assets: [
        {
          name: 'assets/js/hot-update.js',
          size: 2048,
          info: { development: true },
        },
      ],
    } as unknown

    const getTableInfo = (
      plugin as unknown as {
        getTableInfo: (input: unknown) => string | undefined
      }
    ).getTableInfo.bind(plugin)

    expect(getTableInfo(stats)).toBeUndefined()
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

  it('生产构建未生成 stats 时 shutdown 不应抛出二次错误', () => {
    const shutdownIntercept = vi.fn()
    const compiler = {
      options: {
        mode: 'production',
      },
      hooks: {
        environment: { intercept: vi.fn() },
        done: { intercept: vi.fn() },
      },
      cache: {
        hooks: {
          shutdown: {
            tap: vi.fn(),
            intercept: shutdownIntercept,
          },
        },
      },
      __internal__registerBuiltinPlugin: vi.fn(),
    } as never

    new StatsPlugin().apply(compiler)

    const shutdownDone = shutdownIntercept.mock.calls[0][0].done

    expect(() => shutdownDone()).not.toThrow()
  })
})
