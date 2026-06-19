// compile/compile-pipeline.ts — 统一编译管线入口

import { createBuildPlanExecutor } from '../build-plan'
import { createBuiltinPlugins } from '../core/builtin-plugins'
import { createPluginManager } from '../core/plugin-manager'
import { createPlatformAdapter } from '../platform/platform-factory'
import { resolveWebPreConfig } from './web/resolve-web-preconfig'
import { logger } from '../shared/logger'
import {
  Command,
  createCompileContext,
  type CompileContext,
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
  let ctx: CompileContext | undefined

  try {
    ctx = await createCompileContext(params)

    const builtinPlugins = createBuiltinPlugins(ctx)
    const pluginManager = createPluginManager({
      compileContext: ctx,
      builtinPlugins,
      plugins: ctx.userConfig?.plugins ?? [],
    })
    await pluginManager.init()

    const currentUserConfig = await pluginManager.applyIkarosConfig(
      ctx.userConfig,
    )
    await pluginManager.addPlugins(currentUserConfig?.plugins ?? [])

    const platform = createPlatformAdapter(ctx.options.platform, {
      context: ctx.context,
    })

    const resolvedCtx = {
      ...ctx,
      userConfig: currentUserConfig,
    }
    const preConfig = await pluginManager.applyNormalizedConfig(
      await resolveWebPreConfig({
        command: ctx.command,
        context: ctx.context,
        resolveContext: ctx.resolveContext,
        getUserConfig: async () => resolvedCtx.userConfig,
        isElectron: platform.name === 'desktopClient',
      }),
    )
    const basePlans = await platform.createPlans({
      command: ctx.command,
      compileContext: resolvedCtx,
      config: preConfig,
    })
    const plans = await pluginManager.applyBuildPlans(basePlans)
    const executor = createBuildPlanExecutor({
      compileContext: resolvedCtx,
      pluginManager,
    })

    await platform.run({
      command: ctx.command,
      plans,
      compileContext: resolvedCtx,
      pluginManager,
      executor,
      logger,
    })
  } finally {
    if (ctx && ctx.command !== Command.SERVER) {
      ctx.envCleanup()
    }
  }
}
