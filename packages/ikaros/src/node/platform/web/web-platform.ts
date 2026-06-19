// platform/web/web-platform.ts — Web 平台适配器实现

import { createBuildPlan, type BuildPlan } from '../../build-plan'
import type {
  PlatformAdapter,
  PlatformPlanContext,
  PlatformRunContext,
} from '../types'

/**
 * Web 平台适配器
 *
 * 实现 PlatformAdapter 接口，替代原来的 WebCompileService。
 * - resolvePreConfig: 委托给 resolveWebPreConfig 解析 port/pages/browserslist 等
 * - compile: 通过 BundlerAdapter 创建配置并执行 dev/build
 */
export class WebPlatformAdapter implements PlatformAdapter {
  readonly name = 'web' as const

  async createPlans(ctx: PlatformPlanContext): Promise<BuildPlan[]> {
    const { compileContext, command, config } = ctx
    return [
      createBuildPlan({
        id: 'web',
        command,
        platform: 'web',
        target: 'web',
        mode: compileContext.options.mode,
        context: compileContext.context,
        contextPkg: compileContext.contextPkg,
        env: compileContext.env,
        config,
      }),
    ]
  }

  async run(params: PlatformRunContext): Promise<void> {
    const { command, plans, compileContext: ctx, pluginManager, executor } =
      params
    const plan = plans[0]
    if (!plan) {
      throw new Error('[ikaros] web platform requires one build plan')
    }
    await pluginManager.callBeforeCreateCompiler()
    const config = await executor.createConfig(plan)

    // 根据命令执行 dev 或 build
    if (command === 'server') {
      await pluginManager.callBeforeStartDevServer()

      await executor.runDevConfig(plan.bundler, config, {
        port: plan.dev.port,
        onBuildStatus: ctx.onBuildStatus,
        registerCleanup: ctx.registerCleanup,
      })

      await pluginManager.callAfterStartDevServer()
      ctx.registerCleanup?.(() => pluginManager.callOnCloseDevServer())
    } else {
      await pluginManager.callBeforeBuild()

      try {
        const result = await executor.runBuildConfig(plan.bundler, config, {
          onBuildStatus: ctx.onBuildStatus,
        })

        await pluginManager.callAfterBuild(result)
      } finally {
        await pluginManager.callOnCloseBuild()
      }
    }
  }
}
