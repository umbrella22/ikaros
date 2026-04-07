// platform/web/web-platform.ts — Web 平台适配器实现

import type { BundlerAdapter } from '../../bundler/types'
import type { CompileContext } from '../../compile/compile-context'
import type {
  PlatformAdapter,
  PlatformCompileParams,
  PlatformPreConfig,
} from '../types'
import { resolveWebPreConfig } from '../../compile/web/resolve-web-preconfig'

/**
 * Web 平台适配器
 *
 * 实现 PlatformAdapter 接口，替代原来的 WebCompileService。
 * - resolvePreConfig: 委托给 resolveWebPreConfig 解析 port/pages/browserslist 等
 * - compile: 通过 BundlerAdapter 创建配置并执行 dev/build
 */
export class WebPlatformAdapter implements PlatformAdapter {
  readonly name = 'web' as const

  async resolvePreConfig(ctx: CompileContext): Promise<PlatformPreConfig> {
    return resolveWebPreConfig({
      command: ctx.command,
      context: ctx.context,
      resolveContext: ctx.resolveContext,
      getUserConfig: async () => ctx.userConfig,
      isElectron: ctx.isElectron,
    })
  }

  async compile(
    bundler: BundlerAdapter,
    params: PlatformCompileParams,
  ): Promise<void> {
    const { command, preConfig, compileContext: ctx, pluginManager } = params

    await pluginManager.callBeforeCreateCompiler()

    // 生成编译配置
    const config = await bundler.createConfig({
      command,
      mode: ctx.options.mode,
      env: ctx.env,
      context: ctx.context,
      contextPkg: ctx.contextPkg,
      config: preConfig,
      resolveContext: ctx.resolveContext,
      preWarnings: ctx.preWarnings,
    })

    const finalConfig = await pluginManager.applyBundlerConfig(
      bundler.name,
      config,
    )

    // 根据命令执行 dev 或 build
    if (command === 'server') {
      await pluginManager.callBeforeStartDevServer()

      await bundler.runDev(finalConfig, {
        port: preConfig.port,
        onBuildStatus: ctx.onBuildStatus,
        registerCleanup: ctx.registerCleanup,
      })

      await pluginManager.callAfterStartDevServer()
      ctx.registerCleanup?.(() => pluginManager.callOnCloseDevServer())
    } else {
      await pluginManager.callBeforeBuild()

      try {
        const result = await bundler.runBuild(finalConfig, {
          onBuildStatus: ctx.onBuildStatus,
        })

        await pluginManager.callAfterBuild(result)
      } finally {
        await pluginManager.callOnCloseBuild()
      }
    }
  }
}
