// compile/compile-pipeline.ts — 统一编译管线入口

import { createBundlerAdapter } from '../bundler/bundler-factory'
import { createPlatformAdapter } from '../platform/platform-factory'
import {
  createCompileContext,
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

  // 4. 用预配置更新上下文中的 userConfig（resolvePreConfig 可能调整了 userConfig）
  ctx.userConfig = preConfig.userConfig

  // 5. 获取编译器适配器
  const bundler = createBundlerAdapter({
    bundler: ctx.userConfig?.bundler ?? 'rspack',
    loadContextModule: ctx.loadContextModule,
  })

  // 6. 通过平台适配器执行编译
  await platform.compile(bundler, {
    command: ctx.command,
    preConfig,
    compileContext: ctx,
  })
}
