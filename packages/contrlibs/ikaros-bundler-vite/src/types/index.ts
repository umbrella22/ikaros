import type {
  BuildPlan,
  BuildPlanEntry,
  BuildStatus,
  BundlerAdapter,
  BundlerBuildOptions,
  BundlerDevOptions,
} from '@ikaros-cli/ikaros/adapter'
import type { ServerOptions as HttpsServerOptions } from 'node:https'
import type { InlineConfig, PluginOption, ProxyOptions } from 'vite'

export type {
  BuildPlan,
  BuildPlanEntry,
  BuildStatus,
  BundlerAdapter,
  BundlerBuildOptions,
  BundlerDevOptions,
}

export type Command = 'server' | 'build'
export type LibraryFormat = 'es' | 'cjs' | 'umd' | 'iife'

export interface LibraryConfig {
  entry: string | string[] | Record<string, string>
  name?: string
  formats?: LibraryFormat[]
  fileName?: string | ((format: LibraryFormat, entryName: string) => string)
  cssFileName?: string
  externals?: (string | RegExp)[]
  globals?: Record<string, string>
}

export type Pages = Record<
  string,
  {
    html: string
    entry?: string | string[]
  }
>

export interface NormalizedConfig {
  bundler: 'rspack' | 'vite'
  quiet: boolean
  pages: Pages
  enablePages?: string[] | false
  define: Record<string, unknown>
  resolve: {
    alias: Record<string, string>
    extensions: string[]
  }
  server: {
    port: number
    proxy?: Record<string, string | ProxyOptions>
    https: boolean | HttpsServerOptions
  }
  build: {
    base: string
    assetsDir: string
    gzip: boolean
    sourceMap: boolean
    outDirName: string
    outReport: boolean
    cache: boolean
    dependencyCycleCheck: boolean
  }
  vite?: {
    plugins?: PluginOption | PluginOption[]
    config?: InlineConfig
    configFile?: string | false
  }
  library: LibraryConfig | null
  base: string
  port: number
  isElectron: boolean
}

export interface CreateConfigParams {
  command: Command
  mode?: string
  env: Record<string, unknown>
  context: string
  contextPkg?: { name: string; version: string }
  config: NormalizedConfig
  resolveContext: (...paths: string[]) => string
}

export type ViteUserConfigSubset = NormalizedConfig
