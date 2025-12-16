import type { Configuration, DefinePluginOptions } from '@rspack/core'

import type { UserConfig } from '../../user-config'
import type {
  Command,
  CompileOptions,
  PackageJson,
} from '../core/base-compile-service'
import { createWebRspackConfig } from './create-web-rspack-config'
import { resolveWebPreConfig, type WebPreConfig } from './resolve-web-preconfig'
import type { OptionalViteAdapter } from '../../utils/optional-vite'

export type PrepareWebCompileParams = {
  command: Command
  options: CompileOptions
  env: DefinePluginOptions
  context: string
  contextPkg?: PackageJson
  userConfig?: UserConfig
  isElectron: boolean
  resolveContext: (...paths: string[]) => string
  loadViteAdapter?: () => OptionalViteAdapter
}

export type PrepareWebCompileResult = {
  bundler: NonNullable<UserConfig['bundler']>
  config: Configuration | unknown
  pre: WebPreConfig
}

export const prepareWebCompile = async (
  params: PrepareWebCompileParams,
): Promise<PrepareWebCompileResult> => {
  const {
    command,
    options,
    env,
    context,
    contextPkg,
    userConfig,
    isElectron,
    resolveContext,
    loadViteAdapter,
  } = params

  const pre = await resolveWebPreConfig({
    command,
    resolveContext,
    getUserConfig: async () => userConfig,
    isElectron,
  })

  const bundler = pre.userConfig?.bundler ?? 'rspack'

  const createConfig = (): Configuration | unknown => {
    switch (bundler) {
      case 'vite': {
        const adapter = loadViteAdapter?.()
        if (!adapter) {
          throw new Error(
            "bundler='vite' 需要安装可选依赖 @ikaros-cli/ikaros-bundler-vite",
          )
        }

        return adapter.createWebViteConfig({
          command,
          mode: options.mode,
          env: env as unknown as Record<string, unknown>,
          context,
          userConfig: pre.userConfig as unknown as Record<string, unknown>,
          pages: pre.pages as unknown as Record<
            string,
            { html: string; entry: string }
          >,
          base: pre.base,
          port: pre.port,
          isElectron,
          resolveContext,
        })
      }

      case 'rspack':
      default:
        return createWebRspackConfig({
          command,
          mode: options.mode,
          env,
          context,
          contextPkg,
          userConfig: pre.userConfig,
          pages: pre.pages,
          browserslist: pre.browserslist,
          base: pre.base,
          port: pre.port,
          isElectron,
          isVue: pre.isVue,
          isReact: pre.isReact,
          resolveContext,
        })
    }
  }

  const config = createConfig()

  return {
    bundler,
    config,
    pre,
  }
}
