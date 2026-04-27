import type { BundlerAdapter } from './types'
import { RspackAdapter } from './rspack'
import { ViteAdapterLoader } from './vite'

export interface CreateBundlerAdapterParams {
  /** 编译器类型 */
  bundler: 'rspack' | 'vite'
  /** 基于工作目录解析模块路径的能力（用于区分缺依赖与加载失败） */
  resolveContextModule: (id: string) => string | undefined
}

/**
 * 根据 bundler 类型创建编译器适配器实例
 *
 * 这是 bundler 分支逻辑唯一存在的地方。
 * 新增 bundler 只需在此处增加 case + 实现 BundlerAdapter 接口。
 */
export function createBundlerAdapter(
  params: CreateBundlerAdapterParams,
): BundlerAdapter {
  const { bundler, resolveContextModule } = params

  switch (bundler) {
    case 'vite':
      return new ViteAdapterLoader({ resolveContextModule })

    case 'rspack':
    default:
      return new RspackAdapter()
  }
}
