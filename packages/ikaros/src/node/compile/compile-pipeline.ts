// compile/compile-pipeline.ts — 统一编译管线入口

import { createBundlerAdapter } from '../bundler/bundler-factory'
import { createPlatformAdapter } from '../platform/platform-factory'
import {
  createCompileContext,
  Command,
  type CompileContext,
  type CompileServeParams,
} from './compile-context'
import { createWatchdog, runCleanups } from '../watchdog'
import { LoggerSystem } from '../shared/logger'

/**
 * 统一编译管线
 *
 * 线性流程：
 *   1. createCompileContext    — 加载 pkg、env、config
 *   2. createPlatformAdapter   — 根据 platform 创建平台适配器
 *   3. resolvePreConfig        — 解析平台预配置（port、pages 等）
 *   4. createBundlerAdapter    — 根据 bundler 创建编译器适配器
 *   5. platform.compile        — 通过平台适配器执行编译
 */
export async function runCompile(params: CompileServeParams): Promise<void> {
  // 1. 初始化编译上下文（加载 pkg、env、config）
  const ctx = await createCompileContext(params)

  // 2. 获取平台适配器
  const platform = createPlatformAdapter(ctx.options.platform, {
    context: ctx.context,
  })

  // 3. 解析平台预配置
  const preConfig = await platform.resolvePreConfig(ctx)

  // 4. 创建新的上下文对象（不可变更新，避免直接修改原 ctx）
  const updatedCtx: CompileContext = {
    ...ctx,
    userConfig: preConfig.userConfig,
  }

  // 5. 获取编译器适配器
  const bundler = createBundlerAdapter({
    bundler: updatedCtx.userConfig?.bundler ?? 'rspack',
    loadContextModule: updatedCtx.loadContextModule,
    resolveContextModule: updatedCtx.resolveContextModule,
  })

  // 6. 通过平台适配器执行编译
  await platform.compile(bundler, {
    command: updatedCtx.command,
    preConfig,
    compileContext: updatedCtx,
  })
}

/**
 * 带看门狗的编译管线
 *
 * 在 dev 模式下自动监听 env/ 目录和配置文件变更，
 * 变更时自动清理资源并重新执行完整编译流程。
 * build 模式下直接委托给 runCompile()，不启用看门狗。
 */
export async function runCompileWithWatchdog(
  params: CompileServeParams,
): Promise<void> {
  // 非 dev 模式无需看门狗
  if (params.command !== Command.SERVER) {
    return runCompile(params)
  }

  const context = params.context ?? process.cwd()
  const logger = LoggerSystem()

  // 首次编译
  await runCompile(params)

  // 启动看门狗
  const watchdog = createWatchdog({
    context,
    configFile: params.configFile,
    mode: params.options.mode,
    onRestart: async () => {
      try {
        await runCleanups()
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.error({ text: `清理失败，中止本次重启: ${message}` })
        return
      }
      await runCompile(params)
    },
  })

  // 进程退出时清理看门狗
  const cleanup = () => {
    void watchdog.close()
  }
  process.once('SIGINT', cleanup)
  process.once('SIGTERM', cleanup)
}
