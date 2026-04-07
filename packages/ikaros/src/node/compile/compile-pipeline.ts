// compile/compile-pipeline.ts — 统一编译管线入口

import { createBundlerAdapter } from '../bundler/bundler-factory'
import { createBuiltinPlugins } from '../core/builtin-plugins'
import { createPluginManager } from '../core/plugin-manager'
import { createPlatformAdapter } from '../platform/platform-factory'
import {
  createCompileContext,
  type CompileServeParams,
} from './compile-context'

/**
 * 统一编译执行入口
 *
 * 线性流程：
 *   1. createCompileContext    — 加载 pkg、env、config
 *   2. createPluginManager     — 初始化框架插件并允许修改用户配置
 *   3. createPlatformAdapter   — 根据 platform 创建平台适配器
 *   4. resolvePreConfig        — 解析平台预配置（port、pages 等）
 *   5. createBundlerAdapter    — 根据 bundler 创建编译器适配器
 *   6. platform.compile        — 通过平台适配器执行编译
 */
export async function runCompile(params: CompileServeParams): Promise<void> {
  const ctx = await createCompileContext(params)

  const pluginManager = createPluginManager({
    compileContext: ctx,
    plugins: [...createBuiltinPlugins(ctx), ...(ctx.userConfig?.plugins ?? [])],
  })
  await pluginManager.init()

  ctx.userConfig = await pluginManager.applyIkarosConfig(ctx.userConfig)

  const platform = createPlatformAdapter(ctx.options.platform, {
    context: ctx.context,
  })

  const preConfig = await pluginManager.applyNormalizedConfig(
    await platform.resolvePreConfig(ctx),
  )

  const bundler = createBundlerAdapter({
    bundler: preConfig.bundler,
    loadContextModule: ctx.loadContextModule,
    resolveContextModule: ctx.resolveContextModule,
  })

  await platform.compile(bundler, {
    command: ctx.command,
    preConfig,
    compileContext: ctx,
    pluginManager,
  })
}
