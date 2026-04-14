import { describe, expect, it } from 'vitest'
import StatsPlugin from '../../src/node/plugins/stats-plugin'

describe('StatsPlugin', () => {
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
})
