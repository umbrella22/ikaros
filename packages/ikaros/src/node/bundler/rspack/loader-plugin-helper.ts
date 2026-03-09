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
  DEFAULT_HTML_TEMPLATE,
  DEFAULT_PUBLIC_DIR,
} from '../../shared/constants'

type ListItemType = RuleSetRule | Plugin

export type RspackExperiments = {
  import: Record<string, unknown>[]
}

type OtherEnv = {
  frameworkEnv?: DefinePluginOptions
  extEnv?: DefinePluginOptions
  env?: DefinePluginOptions
}

export class BaseCreate<T extends ListItemType> {
  protected list: T[] = []
  protected env: 'development' | 'none' | 'production' = 'development'
  protected mode: string = ''
  protected isDev = true
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
      this.list = this.list.concat(item)
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
  private defaultScriptLoader = (rspackExperiments?: RspackExperiments) => {
    return [
      {
        test: /\.m?ts$/i,
        loader: 'builtin:swc-loader',
        options: {
          jsc: {
            parser: {
              syntax: 'typescript',
            },
          },
        },
        type: 'javascript/auto',
        exclude: [join(this.context, 'node_modules')],
      },
      {
        test: /\.m?js$/i,
        loader: 'builtin:swc-loader',
        options: {
          isModule: 'unknown',
          rspackExperiments,
        },
        type: 'javascript/auto',
        exclude: [join(this.context, 'node_modules')],
      },
    ]
  }
  private defaultResourceLoader: RuleSetRule[] = [
    {
      test: /\.(png|jpe?g|gif|svg|ico)(\?.*)?$/,
      type: 'asset/resource',
      generator: {
        filename: this.isDev ? '[id][ext]' : ASSET_PATHS.img,
      },
    },
    {
      test: /\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/,
      type: 'asset/resource',
      generator: {
        filename: this.isDev ? '[id][ext]' : ASSET_PATHS.media,
      },
    },
    {
      test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
      type: 'asset/resource',
      generator: {
        filename: this.isDev ? '[id][ext]' : ASSET_PATHS.fonts,
      },
    },
  ]

  useDefaultCssLoader(options?: CssLoaderOptions): this {
    const defaultCssLoader = buildCssLoaders(this.env, options)
    defaultCssLoader.forEach((item) => this.add(item as RuleSetRule))
    return this
  }

  useDefaultScriptLoader(options?: RspackExperiments): this {
    this.add(this.defaultScriptLoader(options))
    return this
  }
  useDefaultResourceLoader(): this {
    this.defaultResourceLoader.forEach((item) => this.add(item))
    return this
  }
}

export class CreatePlugins extends BaseCreate<Plugin> {
  useDefaultEnvPlugin(otherEnv?: OtherEnv): this {
    const { frameworkEnv = {}, extEnv = {}, env = {} } = otherEnv ?? {}

    this.add(
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
      this.add(
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
  useHtmlPlugin(templatePath?: string): this {
    this.add(
      new rspack.HtmlRspackPlugin({
        template: templatePath ?? join(this.context, DEFAULT_HTML_TEMPLATE),
      }),
    )
    return this
  }
}

export type Pages = {
  [key: string]: {
    html: string
    entry: string
    library?: import('@rspack/core').LibraryOptions
    options?: {
      title: string
      inject: boolean
      meta: Record<string, string>
    }
  }
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
    this.pages = pages
    this.enablePages = enablePages
    this.getEnablePages()
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
  protected getEnablePages() {
    if (!isEmpty(this.pages) && isArray(this.enablePages)) {
      const reMakePage: Pages = {}
      const notFoundPageName: string[] = []

      for (const item of this.enablePages) {
        if (this.pages[item]) {
          reMakePage[item] = this.pages[item]
        } else {
          notFoundPageName.push(item)
        }
      }

      if (!isEmpty(notFoundPageName)) {
        this.warnings.push({
          source: 'enable-pages',
          message: `当前设置页面${notFoundPageName.join('、')}不存在`,
        })
      }

      if (isEmpty(reMakePage)) {
        return
      }
      this.pages = reMakePage
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
  const baseEnv = mergeUserConfig(extEnv, env)
  const clientEnvs = Object.fromEntries(
    Object.entries(baseEnv).map(([key, val]) => [
      `import.meta.env.${key}`,
      JSON.stringify(val),
    ]),
  )
  return new rspack.DefinePlugin({ ...clientEnvs, ...frameworkEnv })
}
