// compile/compile-pipeline.ts — 统一编译管线入口

import { createBundlerAdapter } from '../bundler/bundler-factory'
import { createPlatformAdapter } from '../platform/platform-factory'
import {
  createCompileContext,
  type CompileContext,
  type CompileServeParams,
} from './compile-context'

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
  const platform = createPlatformAdapter(ctx.options.platform)

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
  })

  // 6. 通过平台适配器执行编译
  await platform.compile(bundler, {
    command: updatedCtx.command,
    preConfig,
    compileContext: updatedCtx,
  })
}
