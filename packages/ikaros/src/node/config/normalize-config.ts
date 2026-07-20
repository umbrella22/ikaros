import type { ServerOptions as HttpsServerOptions } from 'node:https'

import type {
  DefinePluginOptions,
  Loader,
  Plugin,
  SwcLoaderOptions,
} from '@rspack/core'
import chalk from 'chalk'

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

type ServerProxy = NonNullable<UserConfig['dev']>['proxy'] | undefined

export interface NormalizedRspackConfig {
  plugins: Plugin[]
  swc?: SwcLoaderOptions
  loaders: Loader[]
  experiments: RspackExperiments
  moduleFederation: ModuleFederationOptions[]
  cdnOptions: CdnPluginOptions
  css: CssLoaderOptions
}

export interface NormalizedViteConfig {
  plugins: unknown
  config: Record<string, unknown>
  configFile: string | false
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
  resolvedPort?: number
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
    transformImport: [],
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
  sourceUserConfig?: UserConfig
  normalizedConfig: NormalizedConfig
  baseNormalizedConfig?: NormalizedConfig
}): NormalizeConfigDiagnostics {
  const { command, userConfig, normalizedConfig } = params
  const sourceUserConfig = params.sourceUserConfig ?? userConfig
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
        sourceUserConfig?.app?.target !== undefined
          ? 'user.app.target'
          : 'default.app.target',
      reason:
        sourceUserConfig?.app?.target !== undefined
          ? `读取 userConfig.app.target=${baseConfig.target}`
          : `未配置 app.target，使用默认值 ${baseConfig.target}`,
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
    field: 'output.base',
    decision: {
      value: baseConfig.base,
      source:
        sourceUserConfig?.output?.base !== undefined
          ? 'user.output.base'
          : 'default.output.base',
      reason:
        sourceUserConfig?.output?.base !== undefined
          ? `读取 userConfig.output.base=${baseConfig.base}`
          : `未配置 output.base，使用默认值 ${baseConfig.base}`,
    },
    value: normalizedConfig.base,
    baseValue: baseConfig.base,
  })

  let portSource: string
  let portReason: string
  if (sourceUserConfig?.dev?.port !== undefined) {
    portSource = 'user.dev.port'
    portReason = `读取 userConfig.dev.port=${baseConfig.port}`
  } else if (command === Command.SERVER) {
    portSource = 'detect-port'
    portReason = `未配置 dev.port，从默认端口 ${DEFAULT_PORT} 起探测到可用端口 ${baseConfig.port}`
  } else {
    portSource = 'default.dev.port'
    portReason = `构建模式未配置 dev.port，使用默认值 ${baseConfig.port}`
  }

  const port = withPluginOverride({
    field: 'dev.port',
    decision: {
      value: baseConfig.port,
      source: portSource,
      reason: portReason,
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
      requestedPort: sourceUserConfig?.dev?.port ?? DEFAULT_PORT,
      autoDetected:
        command === Command.SERVER && sourceUserConfig?.dev?.port === undefined,
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

  const bundler = userConfig.bundle?.adapter ?? 'rspack'
  const build: NormalizedBuildConfig = {
    ...DEFAULT_BUILD_CONFIG,
    base: userConfig.output?.base ?? DEFAULT_BUILD_CONFIG.base,
    assetsDir: userConfig.output?.assetsDir ?? DEFAULT_BUILD_CONFIG.assetsDir,
    gzip: userConfig.output?.gzip ?? DEFAULT_BUILD_CONFIG.gzip,
    sourceMap: userConfig.output?.sourceMap ?? DEFAULT_BUILD_CONFIG.sourceMap,
    outDirName: userConfig.output?.dir ?? DEFAULT_BUILD_CONFIG.outDirName,
    outReport: userConfig.output?.report ?? DEFAULT_BUILD_CONFIG.outReport,
    cache: userConfig.output?.cache ?? DEFAULT_BUILD_CONFIG.cache,
    dependencyCycleCheck:
      userConfig.output?.checkCycles ??
      DEFAULT_BUILD_CONFIG.dependencyCycleCheck,
  }

  if (command === Command.SERVER && /^https?:/i.test(build.base)) {
    const optsText = chalk.cyan('output.base')
    throw new Error(`本地开发时 ${optsText} 不应该为外部 Host!`)
  }

  const target = userConfig.app?.target ?? 'pc'
  const pages =
    userConfig.pages ?? resolveDefaultPages(resolveContext, isElectron)
  const port = userConfig.dev?.port ?? params.resolvedPort ?? DEFAULT_PORT
  const isReact = checkDependency('react', context)
  const isVue = checkDependency('vue', context)
  const browserslist = resolveBrowserslist(target)

  const server: NormalizedServerConfig = {
    port,
    proxy: userConfig.dev?.proxy,
    https: userConfig.dev?.https ?? false,
  }

  const resolve: NormalizedResolveConfig = {
    alias: {
      '@': resolveContext('src'),
      ...(userConfig.source?.alias ?? {}),
    },
    extensions: userConfig.source?.extensions ?? extensions,
  }

  const rspack: NormalizedRspackConfig = {
    plugins: normalizeList(userConfig.bundle?.rspack?.plugins),
    swc: userConfig.bundle?.rspack?.swc,
    loaders: userConfig.bundle?.rspack?.loaders ?? [],
    experiments: mergeConfig(
      DEFAULT_RSPACK_CONFIG.experiments,
      userConfig.bundle?.rspack?.experiments,
    ),
    moduleFederation: normalizeList(userConfig.bundle?.rspack?.moduleFederation),
    cdnOptions: mergeConfig(
      DEFAULT_RSPACK_CONFIG.cdnOptions,
      userConfig.bundle?.rspack?.cdn,
    ),
    css: mergeConfig(DEFAULT_RSPACK_CONFIG.css, userConfig.bundle?.rspack?.css),
  }

  return {
    bundler,
    plugins: userConfig.plugins ?? [],
    quiet: userConfig.log?.level === 'quiet',
    target,
    pages,
    enablePages: userConfig.dev?.pages ?? false,
    define: userConfig.source?.define ?? {},
    rspack,
    vite: {
      plugins: userConfig.bundle?.vite?.plugins ?? [],
      config: userConfig.bundle?.vite?.config ?? {},
      configFile: userConfig.bundle?.vite?.configFile ?? false,
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
