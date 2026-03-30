import { describe, expect, it } from 'vitest'

import { ViteAdapterLoader } from '../../src/node/bundler/vite/vite-adapter-loader'

describe('ViteAdapterLoader', () => {
  it('缺少依赖时应提示安装可选依赖', () => {
    const adapter = new ViteAdapterLoader({
      loadContextModule: () => {
        throw new Error('should not load')
      },
      resolveContextModule: () => undefined,
    })

    expect(() => adapter.createConfig({} as never)).toThrowError(
      /未安装可选依赖/,
    )
  })

  it('依赖已安装但加载失败时应保留原始错误信息', () => {
    const adapter = new ViteAdapterLoader({
      loadContextModule: () => {
        throw new Error('boom from adapter module')
      },
      resolveContextModule: () =>
        '/virtual/node_modules/@ikaros-cli/ikaros-bundler-vite/index.mjs',
    })

    expect(() => adapter.createConfig({} as never)).toThrowError(
      /已安装但加载失败/,
    )
    expect(() => adapter.createConfig({} as never)).toThrowError(
      /boom from adapter module/,
    )
  })

  it('依赖导出不正确时应给出导出错误', () => {
    const adapter = new ViteAdapterLoader({
      loadContextModule: () => ({ default: {} }),
      resolveContextModule: () =>
        '/virtual/node_modules/@ikaros-cli/ikaros-bundler-vite/index.mjs',
    })

    expect(() => adapter.createConfig({} as never)).toThrowError(
      /未找到 ViteBundlerAdapter 导出/,
    )
  })
})
