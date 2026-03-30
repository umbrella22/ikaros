// platform/web/web-platform.ts — Web 平台适配器实现

import type { BundlerAdapter } from '../../bundler/types'
import type { CompileContext } from '../../compile/compile-context'
import { registerCleanup } from '../../watchdog/cleanup-registry'
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
    const { command, preConfig, compileContext: ctx } = params

    // 生成编译配置
    const config = await bundler.createConfig({
      command,
      mode: ctx.options.mode,
      env: ctx.env,
      context: ctx.context,
      contextPkg: ctx.contextPkg,
      userConfig: preConfig.userConfig,
      pages: preConfig.pages,
      base: preConfig.base,
      port: preConfig.port,
      browserslist: preConfig.browserslist,
      isElectron: ctx.isElectron,
      isVue: preConfig.isVue,
      isReact: preConfig.isReact,
      resolveContext: ctx.resolveContext,
      preWarnings: ctx.preWarnings,
    })

    // 根据命令执行 dev 或 build
    if (command === 'server') {
      await bundler.runDev(config, {
        port: preConfig.port,
        onBuildStatus: ctx.onBuildStatus,
        registerCleanup,
      })
    } else {
      await bundler.runBuild(config, {
        onBuildStatus: ctx.onBuildStatus,
      })
    }
  }
}
