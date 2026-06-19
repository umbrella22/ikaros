import type { ServerOptions as HttpsServerOptions } from 'node:https'

import type {
  DefinePluginOptions,
  Loader,
  Plugin,
  SwcLoaderOptions,
} from '@rspack/core'

import type { CssLoaderOptions } from '../bundler/rspack/css-loaders-helper'
import type { RspackExperiments } from '../bundler/rspack/loader-plugin-helper'
import type { CdnPluginOptions } from '../plugins/cdn-plugin'
import type {
  Bundler,
  ElectronConfig,
  LibraryConfig,
  ModuleFederationOptions,
} from '../config/user-config'
import type { PackageJson } from '../compile/compile-context'

export type BuildTargetKind =
  | 'web'
  | 'electron-main'
  | 'electron-preload'
  | 'electron-renderer'

export interface BuildPlanEntry {
  import: string | string[]
  html?: string
  library?: import('@rspack/core').LibraryOptions
  options?: {
    title?: string
    inject?: boolean
    meta?: Record<string, string>
  }
}

export interface BuildPlanSource {
  define: DefinePluginOptions
  alias: Record<string, string>
  extensions: string[]
  framework: 'react' | 'vue' | 'mixed' | 'none'
  browserslist: string
}

export interface BuildPlanDev {
  port: number
  proxy?: unknown
  https: boolean | HttpsServerOptions
  pages: string[] | false
}

export interface BuildPlanOutput {
  base: string
  dir: string
  assetsDir: string
  gzip: boolean
  sourceMap: boolean
  report: boolean
  cache: boolean
  checkCycles: boolean
}

export interface RspackAdapterOptions {
  plugins: Plugin[]
  swc?: SwcLoaderOptions
  loaders: Loader[]
  experiments: RspackExperiments
  moduleFederation: ModuleFederationOptions[]
  cdn: CdnPluginOptions
  css: CssLoaderOptions
}

export interface ViteAdapterOptions {
  plugins: unknown
}

export interface BuildPlanTrace {
  source: string
  operation: string
  path?: string
  message?: string
}

export interface BuildPlanDiagnostic {
  level: 'info' | 'warning' | 'error'
  source: string
  message: string
}

export interface BuildPlan {
  id: string
  command: 'server' | 'build'
  platform: 'web' | 'desktopClient'
  target: BuildTargetKind
  bundler: Bundler
  mode?: string
  context: string
  contextPkg?: PackageJson
  env: Record<string, unknown>
  entries: Record<string, BuildPlanEntry>
  source: BuildPlanSource
  dev: BuildPlanDev
  output: BuildPlanOutput
  library?: LibraryConfig
  electron?: ElectronConfig
  adapterOptions: {
    rspack?: RspackAdapterOptions
    vite?: ViteAdapterOptions
  }
  provenance: BuildPlanTrace[]
  diagnostics: BuildPlanDiagnostic[]
}
