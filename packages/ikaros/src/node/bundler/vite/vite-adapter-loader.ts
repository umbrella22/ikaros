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
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
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

const createLoadFailedViteError = (cause: unknown): ViteAdapterError => {
  const pkg = '@ikaros-cli/ikaros-bundler-vite'
  const message = cause instanceof Error ? cause.message : String(cause)
  return new ViteAdapterError(
    [
      `${pkg} 已安装但加载失败。`,
      '请确认依赖版本与当前 Node.js 版本兼容。',
      '',
      `原始错误: ${message}`,
    ].join('\n'),
    { cause },
  )
}

const createInvalidViteExportError = (): ViteAdapterError => {
  const pkg = '@ikaros-cli/ikaros-bundler-vite'
  return new ViteAdapterError(
    [
      `${pkg} 已安装但加载失败：未找到 ViteBundlerAdapter 导出。`,
      '请确认安装的版本与 @ikaros-cli/ikaros 兼容。',
    ].join('\n'),
  )
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
  private readonly resolveContextModule: (id: string) => string | undefined

  constructor(params: {
    loadContextModule: <T>(id: string) => T
    resolveContextModule: (id: string) => string | undefined
  }) {
    this.loadContextModule = params.loadContextModule
    this.resolveContextModule = params.resolveContextModule
  }

  private ensureAdapter(): LoadedViteAdapter {
    if (this.adapter) return this.adapter

    // 使用共享的版本检查（Vite 7 需要 Node.js >= 22）
    assertNodeVersion(22)

    const pkg = '@ikaros-cli/ikaros-bundler-vite'
    if (!this.resolveContextModule(pkg)) {
      throw createMissingViteError()
    }

    let mod:
      | { ViteBundlerAdapter: new () => LoadedViteAdapter }
      | { default?: { ViteBundlerAdapter: new () => LoadedViteAdapter } }

    try {
      mod = this.loadContextModule<
        | { ViteBundlerAdapter: new () => LoadedViteAdapter }
        | { default?: { ViteBundlerAdapter: new () => LoadedViteAdapter } }
      >(pkg)
    } catch (err) {
      throw createLoadFailedViteError(err)
    }

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
      throw createInvalidViteExportError()
    }

    this.adapter = new AdapterClass()
    return this.adapter
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
