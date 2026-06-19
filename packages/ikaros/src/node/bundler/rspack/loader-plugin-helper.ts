import {
  type RuleSetRule,
  type DefinePluginOptions,
  type Plugin,
  rspack,
  type Entry,
  type RspackPluginInstance,
} from '@rspack/core'

import { buildCssLoaders, type CssLoaderOptions } from './css-loaders-helper'
import { join } from 'path'
import { isArray, isEmpty } from 'es-toolkit/compat'
import { mergeUserConfig } from '../../shared/common'
import type { PreWarning } from '../../plugins/pre-warnings-plugin'
import {
  ASSET_PATHS,
  DEFAULT_PUBLIC_DIR,
} from '../../shared/constants'
import type { RspackSemanticItem } from './semantic-registry'

type ListItemType = RuleSetRule | Plugin
export type RspackRuleItem = RspackSemanticItem<RuleSetRule>

export type RspackExperiments = {
  import?: Record<string, unknown>[]
  transformImport?: Record<string, unknown>[]
}

function resolveTransformImport(
  rspackExperiments?: RspackExperiments,
): Record<string, unknown>[] | undefined {
  const transformImport =
    rspackExperiments?.transformImport ?? rspackExperiments?.import

  return transformImport && transformImport.length > 0
    ? transformImport
    : undefined
}

type OtherEnv = {
  frameworkEnv?: DefinePluginOptions
  extEnv?: DefinePluginOptions
  env?: DefinePluginOptions
}

export class BaseCreate<T extends ListItemType> {
  protected list: T[] = []
  protected env: 'development' | 'none' | 'production'
  protected mode: string
  protected isDev: boolean
  protected context: string
  constructor({
    env = 'development',
    mode = '',
    context = process.cwd(),
  }: {
    env: 'development' | 'none' | 'production'
    mode?: string
    context?: string
  }) {
    this.env = env
    this.mode = mode
    this.isDev = env === 'development'
    this.context = context
  }

  add(item: T | T[] | undefined): this {
    if (!item) {
      return this
    }
    if (isArray(item)) {
      this.list.push(...item)
    } else {
      this.list.push(item)
    }
    return this
  }

  end(): T[] {
    return this.list
  }
}

export class CreateLoader extends BaseCreate<RuleSetRule> {
  private defaultScriptLoader = (options?: {
    rspackExperiments?: RspackExperiments
    swc?: Record<string, unknown>
  }): RspackRuleItem[] => {
    const transformImport = resolveTransformImport(options?.rspackExperiments)
    // 用户提供的 swc 选项深合并进每条脚本规则的 options。
    // ikaros 只设置按扩展名解析所必需的 jsc.parser，不强加任何框架相关转换
    // （如 React 的 transform.react / refresh），后者完全由用户在 bundle.rspack.swc 中显式提供。
    const userSwc = options?.swc
    const withSwc = (base: Record<string, unknown>): Record<string, unknown> =>
      userSwc ? mergeUserConfig(base, userSwc) : base

    return [
      {
        id: 'script:tsx',
        value: {
          test: /\.tsx$/i,
          loader: 'builtin:swc-loader',
          options: withSwc({
            jsc: {
              parser: {
                syntax: 'typescript',
                jsx: true,
              },
            },
          }),
          type: 'javascript/auto',
          exclude: /node_modules/,
        },
      },
      {
        id: 'script:ts',
        value: {
          test: /\.m?ts$/i,
          loader: 'builtin:swc-loader',
          options: withSwc({
            jsc: {
              parser: {
                syntax: 'typescript',
              },
            },
          }),
          type: 'javascript/auto',
          exclude: /node_modules/,
        },
      },
      {
        id: 'script:jsx',
        value: {
          test: /\.jsx$/i,
          loader: 'builtin:swc-loader',
          options: withSwc({
            jsc: {
              parser: {
                syntax: 'ecmascript',
                jsx: true,
              },
            },
          }),
          type: 'javascript/auto',
          exclude: /node_modules/,
        },
      },
      {
        id: 'script:js',
        value: {
          test: /\.m?js$/i,
          loader: 'builtin:swc-loader',
          options: withSwc({
            isModule: 'unknown',
            ...(transformImport ? { transformImport } : {}),
          }),
          type: 'javascript/auto',
          exclude: /node_modules/,
        },
      },
    ]
  }
  private defaultResourceLoader: RspackRuleItem[] = [
    {
      id: 'asset:image',
      value: {
        test: /\.(png|jpe?g|gif|svg|ico)(\?.*)?$/,
        type: 'asset/resource',
        generator: {
          filename: this.isDev ? '[id][ext]' : ASSET_PATHS.img,
        },
      },
    },
    {
      id: 'asset:media',
      value: {
        test: /\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/,
        type: 'asset/resource',
        generator: {
          filename: this.isDev ? '[id][ext]' : ASSET_PATHS.media,
        },
      },
    },
    {
      id: 'asset:font',
      value: {
        test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
        type: 'asset/resource',
        generator: {
          filename: this.isDev ? '[id][ext]' : ASSET_PATHS.fonts,
        },
      },
    },
  ]

  createDefaultRuleItems(options?: {
    rspackExperiments?: RspackExperiments
    swc?: Record<string, unknown>
    css?: CssLoaderOptions
    extraLoaders?: RuleSetRule[]
  }): RspackRuleItem[] {
    const cssRules = buildCssLoaders(this.env, options?.css).map((rule) => ({
      id: `style:${readRuleExtension(rule)}`,
      value: rule as RuleSetRule,
    }))
    const extraRules = (options?.extraLoaders ?? []).map((rule, index) => ({
      id: `user:loader:${index}`,
      value: rule,
    }))

    return [
      ...this.defaultResourceLoader,
      ...this.defaultScriptLoader({
        rspackExperiments: options?.rspackExperiments,
        swc: options?.swc,
      }),
      ...cssRules,
      ...extraRules,
    ]
  }

  useDefaultScriptLoader(options?: {
    rspackExperiments?: RspackExperiments
    swc?: Record<string, unknown>
  }): this {
    this.add(this.defaultScriptLoader(options).map((item) => item.value))
    return this
  }
}

function readRuleExtension(rule: RuleSetRule): string {
  const test = rule.test
  if (test instanceof RegExp) {
    const match = test.source.match(/\\\.([a-z0-9]+)\$/i)
    if (match?.[1]) {
      return match[1]
    }
  }

  return 'unknown'
}

function normalizeDefineValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return JSON.stringify(value)
  }

  if (value !== null && typeof value === 'object') {
    return JSON.stringify(value)
  }

  return value
}

function normalizeDefineOptions(
  define: DefinePluginOptions,
): DefinePluginOptions {
  return Object.fromEntries(
    Object.entries(define).map(([key, value]) => [
      key,
      normalizeDefineValue(value),
    ]),
  ) as DefinePluginOptions
}

export class CreatePlugins extends BaseCreate<Plugin> {
  private pluginIds: string[] = []

  addPlugin(id: string, plugin: Plugin | undefined): this {
    if (!plugin) {
      return this
    }

    this.pluginIds.push(id)
    return this.add(plugin)
  }

  endWithIds(): Array<RspackSemanticItem<Plugin>> {
    return this.end().map((plugin, index) => ({
      id: this.pluginIds[index] ?? `core:plugin:${index}`,
      value: plugin,
    }))
  }

  useDefaultEnvPlugin(otherEnv?: OtherEnv): this {
    const { frameworkEnv = {}, extEnv = {}, env = {} } = otherEnv ?? {}

    this.addPlugin(
      'define:env',
      createEnvPlugin({
        frameworkEnv,
        extEnv,
        env,
      }),
    )
    return this
  }
  useCopyPlugin(): this {
    if (this.env === 'production') {
      this.addPlugin(
        'copy:public',
        new rspack.CopyRspackPlugin({
          patterns: [
            {
              context: join(this.context, DEFAULT_PUBLIC_DIR),
              from: './',
              noErrorOnMissing: true,
              globOptions: {
                ignore: ['**/index.html', '.*'],
              },
            },
          ],
        }),
      )
    }
    return this
  }
}

export type Pages = {
  [key: string]: {
    html: string
    entry: string | string[]
    library?: import('@rspack/core').LibraryOptions
    options?: {
      title: string
      inject: boolean
      meta: Record<string, string>
    }
  }
}

function resolveEnabledPages(
  pages: Pages,
  enablePages: string[] | false | undefined,
  warnings?: PreWarning[],
): Pages {
  if (isEmpty(pages) || !isArray(enablePages)) {
    return pages
  }

  const reMakePage: Pages = {}
  const notFoundPageName: string[] = []

  for (const item of enablePages) {
    if (pages[item]) {
      reMakePage[item] = pages[item]
    } else {
      notFoundPageName.push(item)
    }
  }

  if (!isEmpty(notFoundPageName)) {
    warnings?.push({
      source: 'enable-pages',
      message: `当前设置页面${notFoundPageName.join('、')}不存在`,
    })
  }

  return reMakePage
}

export function createMpaEntry({
  pages,
  enablePages,
}: {
  pages: Pages
  enablePages?: string[] | false
}): Entry {
  const enabledPages = resolveEnabledPages(pages, enablePages)
  const entry: Entry = {}

  for (const page of Object.keys(enabledPages)) {
    entry[page] = {
      import: enabledPages[page].entry,
      library: enabledPages[page].library,
    }
  }

  return entry
}

export class CreateMpaAssets {
  protected pages: Pages
  protected enablePages: string[] | false | undefined
  readonly warnings: PreWarning[] = []
  constructor({
    pages,
    enablePages,
  }: {
    pages: Pages
    enablePages?: string[] | false
  }) {
    this.pages = resolveEnabledPages(pages, enablePages, this.warnings)
    this.enablePages = enablePages
  }
  create() {
    const entry: Entry = {}
    const plugins: Plugin[] = []

    for (const page of Object.keys(this.pages)) {
      entry[page] = {
        import: this.pages[page].entry,
        library: this.pages[page].library,
      }
      plugins.push(
        new rspack.HtmlRspackPlugin({
          template: this.pages[page].html,
          filename: `${page}.html`,
          chunks: [page],
          scriptLoading: 'blocking',
          ...this.pages[page].options,
        }),
      )
    }

    return {
      entry,
      plugins,
    }
  }
}

function createEnvPlugin({
  frameworkEnv = {},
  extEnv = {},
  env = {},
}: {
  frameworkEnv?: DefinePluginOptions
  extEnv?: DefinePluginOptions
  env?: DefinePluginOptions
}): RspackPluginInstance {
  const clientEnvs = Object.fromEntries(
    Object.entries(env).map(([key, val]) => [
      `import.meta.env.${key}`,
      JSON.stringify(val),
    ]),
  )
  return new rspack.DefinePlugin({
    ...clientEnvs,
    ...normalizeDefineOptions(extEnv),
    ...normalizeDefineOptions(frameworkEnv),
  })
}
