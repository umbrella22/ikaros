import type { ServerOptions as HttpsServerOptions } from 'node:https'
import type {
  InlineConfig,
  PluginOption,
  ProxyOptions,
  ViteDevServer,
} from 'vite'

export type Command = 'server' | 'build'

export type BuildStatus = {
  success: boolean
  port?: number
  message?: string
}

export type Pages = Record<
  string,
  {
    html: string
    entry: string
  }
>

export type IkarosWebUserConfigSubset = {
  enablePages?: string[] | false
  define?: Record<string, unknown>
  resolve?: {
    alias?: Record<string, string>
    extensions?: string[]
  }
  server?: {
    port?: number
    proxy?: Record<string, string | ProxyOptions>
    https?: boolean | HttpsServerOptions
  }
  build?: {
    base?: string
    assetsDir?: string
    gzip?: boolean
    sourceMap?: boolean
    outDirName?: string
    outReport?: boolean
    dependencyCycleCheck?: boolean
  }
  vite?: {
    plugins?: PluginOption | PluginOption[]
  }
}

export type CreateWebViteConfigParams = {
  command: Command
  mode?: string
  env: Record<string, unknown>
  context: string
  userConfig?: IkarosWebUserConfigSubset
  pages: Pages
  base: string
  port: number
  isElectron: boolean
  resolveContext: (...paths: string[]) => string
}

export type ViteAdapter = {
  createWebViteConfig: (params: CreateWebViteConfigParams) => InlineConfig
  runViteBuild: (
    config: InlineConfig,
    options?: { onBuildStatus?: (status: BuildStatus) => void },
  ) => Promise<string | undefined>
  startViteDevServer: (
    config: InlineConfig,
    options?: { port?: number; onBuildStatus?: (status: BuildStatus) => void },
  ) => Promise<ViteDevServer>
}
