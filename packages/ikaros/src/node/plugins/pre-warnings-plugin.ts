import type { Compiler, RspackPluginInstance } from '@rspack/core'

const PLUGIN_NAME = '@rspack/ikaros-pre-warnings-plugin'

export type PreWarning = {
  source: string
  message: string
}

/**
 * 将编译器创建之前收集到的警告注入 compilation logger，
 * 使其被 stats.logging 收录，在 console.clear() 之后由 stats-plugin 统一输出。
 * 每条警告按 source 分组，source 即为 stats.logging 中的 key / 显示前缀。
 */
export class PreWarningsPlugin implements RspackPluginInstance {
  constructor(
    private warnings: PreWarning[],
    private quiet = false,
  ) {}

  apply(compiler: Compiler): void {
    if (this.quiet || this.warnings.length === 0) return

    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
      for (const { source, message } of this.warnings) {
        const logger = compilation.getLogger(source)
        logger.warn(message)
      }
    })
  }
}
