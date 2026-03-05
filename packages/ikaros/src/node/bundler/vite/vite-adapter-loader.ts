import type {
  BundlerAdapter,
  BundlerBuildOptions,
  BundlerDevOptions,
  CreateConfigParams,
} from '../types'
import { assertNodeVersion } from '../../shared/check-env'

/**
 * 可选 Vite 依赖加载的 adapter 接口
 *
 * 与 @ikaros-cli/ikaros-bundler-vite 导出的 ViteBundlerAdapter 结构对齐。
 */
type LoadedViteAdapter = BundlerAdapter<unknown>

/**
 * 自定义错误类，用于标识 Vite 适配器加载阶段的已知错误
 */
class ViteAdapterError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ViteAdapterError'
  }
}

const createMissingViteError = (): ViteAdapterError => {
  const pkg = '@ikaros-cli/ikaros-bundler-vite'
  const lines = [
    `你启用了 bundler='vite'，但未安装可选依赖 ${pkg}。`,
    '',
    '请安装后重试：',
    `  pnpm add -D ${pkg}`,
  ]
  return new ViteAdapterError(lines.join('\n'))
}

/**
 * Vite 编译器适配器（懒加载代理）
 *
 * 通过 loadContextModule 动态加载 @ikaros-cli/ikaros-bundler-vite，
 * 实例化其导出的 ViteBundlerAdapter，直接代理 BundlerAdapter 接口。
 *
 * adapter 实例由 BundlerFactory 创建并统一持有，无需外部手动缓存。
 */
export class ViteAdapterLoader implements BundlerAdapter<unknown> {
  readonly name = 'vite' as const

  private adapter: LoadedViteAdapter | undefined
  private readonly loadContextModule: <T>(id: string) => T

  constructor(params: { loadContextModule: <T>(id: string) => T }) {
    this.loadContextModule = params.loadContextModule
  }

  private ensureAdapter(): LoadedViteAdapter {
    if (this.adapter) return this.adapter

    // 使用共享的版本检查（Vite 7 需要 Node.js >= 22）
    assertNodeVersion(22)

    try {
      const mod = this.loadContextModule<
        | { ViteBundlerAdapter: new () => LoadedViteAdapter }
        | { default?: { ViteBundlerAdapter: new () => LoadedViteAdapter } }
      >('@ikaros-cli/ikaros-bundler-vite')

      const exports =
        (
          mod as {
            default?: { ViteBundlerAdapter: new () => LoadedViteAdapter }
          }
        ).default ?? mod

      const AdapterClass = (
        exports as { ViteBundlerAdapter: new () => LoadedViteAdapter }
      ).ViteBundlerAdapter

      if (typeof AdapterClass !== 'function') {
        throw createMissingViteError()
      }

      this.adapter = new AdapterClass()
      return this.adapter
    } catch (err) {
      if (err instanceof ViteAdapterError) {
        throw err
      }
      throw createMissingViteError()
    }
  }

  createConfig(params: CreateConfigParams): unknown | Promise<unknown> {
    return this.ensureAdapter().createConfig(params)
  }

  async runDev(config: unknown, options: BundlerDevOptions): Promise<void> {
    return this.ensureAdapter().runDev(config, options)
  }

  async runBuild(
    config: unknown,
    options: BundlerBuildOptions,
  ): Promise<string | undefined> {
    return this.ensureAdapter().runBuild(config, options)
  }
}
