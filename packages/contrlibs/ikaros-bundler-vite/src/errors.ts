/**
 * 结构化编译错误
 *
 * 携带编译阶段上下文，与主包 P0.6 的错误收口策略对齐。
 * 内部统一 throw BundlerError，由顶层 CLI 入口决定退出码与输出格式。
 */
export class BundlerError extends Error {
  override readonly name = 'BundlerError'

  constructor(
    message: string,
    public readonly phase: 'config' | 'dev' | 'build',
    options?: { cause?: unknown },
  ) {
    super(message, options)
  }
}
