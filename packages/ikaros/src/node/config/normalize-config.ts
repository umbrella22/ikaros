import type { ServerOptions as HttpsServerOptions } from 'node:https'

import type { DefinePluginOptions, Loader, Plugin } from '@rspack/core'
import chalk from 'chalk'
import { detect } from 'detect-port'

import type { CssLoaderOptions } from '../bundler/rspack/css-loaders-helper'
import type {
  Pages,
  RspackExperiments,
} from '../bundler/rspack/loader-plugin-helper'
import { Command } from '../compile/compile-context'
import type { CdnPluginOptions } from '../plugins/cdn-plugin'
import { checkDependency } from '../shared/common'
import {
  BROWSERSLIST,
  DEFAULT_BASE_PATH,
  DEFAULT_ENTRY_PATH,
  DEFAULT_HTML_TEMPLATE,
  DEFAULT_OUT_DIR,
  DEFAULT_PORT,
  extensions,
} from '../shared/constants'
import { mergeConfig } from './merge-config'
import type {
  Bundler,
  ElectronConfig,
  IkarosPlugin,
  LibraryConfig,
  ModuleFederationOptions,
  UserConfig,
} from './user-config'

type ServerProxy = NonNullable<UserConfig['server']>['proxy'] | undefined

export interface NormalizedRspackConfig {
  plugins: Plugin[]
  loaders: Loader[]
  experiments: RspackExperiments
  moduleFederation: ModuleFederationOptions[]
  cdnOptions: CdnPluginOptions
  css: CssLoaderOptions
}

export interface NormalizedViteConfig {
  plugins: unknown
}

export interface NormalizedServerConfig {
  port: number
  proxy: ServerProxy
  https: boolean | HttpsServerOptions
}

export interface NormalizedBuildConfig {
  base: string
  assetsDir: string
  gzip: boolean
  sourceMap: boolean
  outDirName: string
  outReport: boolean
  cache: boolean
  dependencyCycleCheck: boolean
}

export interface NormalizedResolveConfig {
  alias: Record<string, string>
  extensions: string[]
}

export interface NormalizedConfig {
  bundler: Bundler
  plugins: IkarosPlugin[]
  quiet: boolean
  target: 'pc' | 'mobile'
  pages: Pages
  enablePages: string[] | false
  define: DefinePluginOptions
  rspack: NormalizedRspackConfig
  vite: NormalizedViteConfig
  server: NormalizedServerConfig
  build: NormalizedBuildConfig
  resolve: NormalizedResolveConfig
  library: LibraryConfig | null
  electron: ElectronConfig
  base: string
  port: number
  browserslist: string
  isVue: boolean
  isReact: boolean
  isElectron: boolean
}

export interface ExplainableDecision<TValue> {
  value: TValue
  source: string
  reason: string
  overriddenFrom?: TValue
}

export interface NormalizeFrameworkDiagnostics {
  react: ExplainableDecision<boolean>
  vue: ExplainableDecision<boolean>
  selected: ExplainableDecision<'react' | 'vue' | 'mixed' | 'none'>
}

export interface NormalizeConfigDiagnostics {
  target: ExplainableDecision<NormalizedConfig['target']>
  browserslist: ExplainableDecision<string>
  base: ExplainableDecision<string> & {
    isExternalUrl: boolean
    devServerCompatible: boolean
    validation: 'accepted' | 'rejected' | 'skipped'
  }
  port: ExplainableDecision<number> & {
    requestedPort: number
    autoDetected: boolean
  }
  framework: NormalizeFrameworkDiagnostics
}

export interface NormalizeConfigParams {
  command: Command
  context: string
  resolveContext: (...paths: string[]) => string
  userConfig?: UserConfig
  isElectron?: boolean
}

const DEFAULT_BUILD_CONFIG: NormalizedBuildConfig = {
  base: DEFAULT_BASE_PATH,
  assetsDir: '',
  gzip: false,
  sourceMap: false,
  outDirName: DEFAULT_OUT_DIR,
  outReport: false,
  cache: false,
  dependencyCycleCheck: false,
}

const DEFAULT_RSPACK_CONFIG: NormalizedRspackConfig = {
  plugins: [],
  loaders: [],
  experiments: {
    import: [],
  },
  moduleFederation: [],
  cdnOptions: {
    modules: [],
  },
  css: {},
}

function resolveBrowserslist(target: NormalizedConfig['target']): string {
  const list = target === 'mobile' ? BROWSERSLIST.mobile : BROWSERSLIST.pc
  return list.join(',')
}

function resolveDefaultPages(
  resolveContext: NormalizeConfigParams['resolveContext'],
  isElectron: boolean,
): Pages {
  if (isElectron) {
    return {
      index: {
        html: resolveContext(`src/renderer/${DEFAULT_HTML_TEMPLATE}`),
        entry: resolveContext('src/renderer/index'),
      },
    }
  }

  return {
    index: {
      html: resolveContext(DEFAULT_HTML_TEMPLATE),
      entry: resolveContext(DEFAULT_ENTRY_PATH),
    },
  }
}

function normalizeList<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return []
  }

  return (Array.isArray(value) ? value : [value]).filter(Boolean) as T[]
}

function formatDiagnosticValue(value: string | number | boolean): string {
  if (typeof value === 'string') {
    return value
  }

  return String(value)
}

function withPluginOverride<TValue extends string | number | boolean>(params: {
  field: string
  decision: ExplainableDecision<TValue>
  value: TValue
  baseValue: TValue
}): ExplainableDecision<TValue> {
  const { field, decision, value, baseValue } = params

  if (value === baseValue) {
    return {
      ...decision,
      value,
    }
  }

  return {
    value,
    source: 'plugin.modifyNormalizedConfig',
    reason: `插件在 modifyNormalizedConfig 阶段将 ${field} 从 ${formatDiagnosticValue(
      baseValue,
    )} 改为 ${formatDiagnosticValue(value)}`,
    overriddenFrom: baseValue,
  }
}

function resolveFrameworkKind(params: {
  isReact: boolean
  isVue: boolean
}): 'react' | 'vue' | 'mixed' | 'none' {
  const { isReact, isVue } = params
  if (isReact && isVue) {
    return 'mixed'
  }

  if (isReact) {
    return 'react'
  }

  if (isVue) {
    return 'vue'
  }

  return 'none'
}

function createFrameworkReason(
  kind: 'react' | 'vue' | 'mixed' | 'none',
): string {
  switch (kind) {
    case 'react':
      return '仅检测到 react 依赖，因此框架判定为 react'
    case 'vue':
      return '仅检测到 vue 依赖，因此框架判定为 vue'
    case 'mixed':
      return '同时检测到 react 与 vue 依赖，框架判定为 mixed'
    default:
      return '未检测到 react 或 vue 依赖，框架判定为 none'
  }
}

export function explainNormalizedConfig(params: {
  command: Command
  userConfig?: UserConfig
  normalizedConfig: NormalizedConfig
  baseNormalizedConfig?: NormalizedConfig
}): NormalizeConfigDiagnostics {
  const { command, userConfig, normalizedConfig } = params
  const baseConfig = params.baseNormalizedConfig ?? normalizedConfig
  const baseIsExternal = /^https?:/i.test(normalizedConfig.base)
  const baseValidation =
    command === Command.SERVER
      ? baseIsExternal
        ? 'rejected'
        : 'accepted'
      : 'skipped'

  const target = withPluginOverride({
    field: 'target',
    decision: {
      value: baseConfig.target,
      source:
        userConfig?.target !== undefined ? 'user.target' : 'default.target',
      reason:
        userConfig?.target !== undefined
          ? `读取 userConfig.target=${baseConfig.target}`
          : `未配置 target，使用默认值 ${baseConfig.target}`,
    },
    value: normalizedConfig.target,
    baseValue: baseConfig.target,
  })

  const browserslist = withPluginOverride({
    field: 'browserslist',
    decision: {
      value: baseConfig.browserslist,
      source: `target.${baseConfig.target}`,
      reason: `根据 target=${baseConfig.target} 选择 browserslist 预设`,
    },
    value: normalizedConfig.browserslist,
    baseValue: baseConfig.browserslist,
  })

  const base = withPluginOverride({
    field: 'build.base',
    decision: {
      value: baseConfig.base,
      source:
        userConfig?.build?.base !== undefined
          ? 'user.build.base'
          : 'default.build.base',
      reason:
        userConfig?.build?.base !== undefined
          ? `读取 userConfig.build.base=${baseConfig.base}`
          : `未配置 build.base，使用默认值 ${baseConfig.base}`,
    },
    value: normalizedConfig.base,
    baseValue: baseConfig.base,
  })

  const port = withPluginOverride({
    field: 'server.port',
    decision: {
      value: baseConfig.port,
      source:
        userConfig?.server?.port !== undefined
          ? 'user.server.port'
          : 'detect-port',
      reason:
        userConfig?.server?.port !== undefined
          ? `读取 userConfig.server.port=${baseConfig.port}`
          : `未配置 server.port，从默认端口 ${DEFAULT_PORT} 起探测到可用端口 ${baseConfig.port}`,
    },
    value: normalizedConfig.port,
    baseValue: baseConfig.port,
  })

  const react = withPluginOverride({
    field: 'framework.react',
    decision: {
      value: baseConfig.isReact,
      source: baseConfig.isReact
        ? 'dependency.react'
        : 'dependency.react.missing',
      reason: baseConfig.isReact ? '检测到 react 依赖' : '未检测到 react 依赖',
    },
    value: normalizedConfig.isReact,
    baseValue: baseConfig.isReact,
  })

  const vue = withPluginOverride({
    field: 'framework.vue',
    decision: {
      value: baseConfig.isVue,
      source: baseConfig.isVue ? 'dependency.vue' : 'dependency.vue.missing',
      reason: baseConfig.isVue ? '检测到 vue 依赖' : '未检测到 vue 依赖',
    },
    value: normalizedConfig.isVue,
    baseValue: baseConfig.isVue,
  })

  const baseFrameworkKind = resolveFrameworkKind(baseConfig)
  const selected = withPluginOverride({
    field: 'framework.selected',
    decision: {
      value: baseFrameworkKind,
      source: `framework.${baseFrameworkKind}`,
      reason: createFrameworkReason(baseFrameworkKind),
    },
    value: resolveFrameworkKind(normalizedConfig),
    baseValue: baseFrameworkKind,
  })

  return {
    target,
    browserslist,
    base: {
      ...base,
      isExternalUrl: baseIsExternal,
      devServerCompatible: !baseIsExternal,
      validation: baseValidation,
    },
    port: {
      ...port,
      requestedPort: userConfig?.server?.port ?? DEFAULT_PORT,
      autoDetected: userConfig?.server?.port === undefined,
    },
    framework: {
      react,
      vue,
      selected,
    },
  }
}

export async function normalizeConfig(
  params: NormalizeConfigParams,
): Promise<NormalizedConfig> {
  const { command, context, resolveContext } = params
  const userConfig = params.userConfig ?? {}
  const isElectron = Boolean(params.isElectron)

  const bundler = userConfig.bundler ?? 'rspack'
  const build = mergeConfig(DEFAULT_BUILD_CONFIG, userConfig.build)

  if (command === Command.SERVER && /^https?:/.test(build.base)) {
    const optsText = chalk.cyan('build.base')
    throw new Error(`本地开发时 ${optsText} 不应该为外部 Host!`)
  }

  const target = userConfig.target ?? 'pc'
  const pages =
    userConfig.pages ?? resolveDefaultPages(resolveContext, isElectron)
  const port = userConfig.server?.port ?? (await detect(String(DEFAULT_PORT)))
  const isReact = checkDependency('react', context)
  const isVue = checkDependency('vue', context)
  const browserslist = resolveBrowserslist(target)

  const server: NormalizedServerConfig = {
    port,
    proxy: userConfig.server?.proxy,
    https: userConfig.server?.https ?? false,
  }

  const resolve: NormalizedResolveConfig = {
    alias: {
      '@': resolveContext('src'),
      ...(userConfig.resolve?.alias ?? {}),
    },
    extensions: userConfig.resolve?.extensions ?? extensions,
  }

  const rspack: NormalizedRspackConfig = {
    plugins: normalizeList(userConfig.rspack?.plugins),
    loaders: userConfig.rspack?.loaders ?? [],
    experiments: mergeConfig(
      DEFAULT_RSPACK_CONFIG.experiments,
      userConfig.rspack?.experiments,
    ),
    moduleFederation: normalizeList(userConfig.rspack?.moduleFederation),
    cdnOptions: mergeConfig(
      DEFAULT_RSPACK_CONFIG.cdnOptions,
      userConfig.rspack?.cdnOptions,
    ),
    css: mergeConfig(DEFAULT_RSPACK_CONFIG.css, userConfig.rspack?.css),
  }

  return {
    bundler,
    plugins: userConfig.plugins ?? [],
    quiet: userConfig.quiet ?? false,
    target,
    pages,
    enablePages: userConfig.enablePages ?? false,
    define: userConfig.define ?? {},
    rspack,
    vite: {
      plugins: userConfig.vite?.plugins ?? [],
    },
    server,
    build,
    resolve,
    library: userConfig.library ?? null,
    electron: userConfig.electron ?? {},
    base: build.base,
    port,
    browserslist,
    isVue,
    isReact,
    isElectron,
  }
}
