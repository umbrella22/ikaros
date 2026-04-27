import { describe, expect, it } from 'vitest'

import { ViteAdapterLoader } from '../../src/node/bundler/vite/vite-adapter-loader'

describe('ViteAdapterLoader', () => {
  it('缺少依赖时应提示安装可选依赖', async () => {
    const adapter = new ViteAdapterLoader({
      resolveContextModule: () => undefined,
    })

    await expect(adapter.createConfig({} as never)).rejects.toThrowError(
      /未安装可选依赖/,
    )
  })

  it('依赖已安装但加载失败时应保留原始错误信息', async () => {
    const adapter = new ViteAdapterLoader({
      resolveContextModule: () =>
        'data:text/javascript,throw new Error("boom from adapter module")',
    })

    await expect(adapter.createConfig({} as never)).rejects.toThrowError(
      /已安装但加载失败/,
    )
    await expect(adapter.createConfig({} as never)).rejects.toThrowError(
      /boom from adapter module/,
    )
  })

  it('依赖导出不正确时应给出导出错误', async () => {
    const adapter = new ViteAdapterLoader({
      resolveContextModule: () => 'data:text/javascript,export default {}',
    })

    await expect(adapter.createConfig({} as never)).rejects.toThrowError(
      /未找到 ViteBundlerAdapter 导出/,
    )
  })
})
