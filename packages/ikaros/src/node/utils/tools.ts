import {
  type RuleSetRule,
  type DefinePluginOptions,
  type Plugin,
  rspack,
  type Entry,
} from '@rspack/core'

import {
  createEnvPlugin,
  buildCssLoaders,
  type CssLoaderOptions,
} from './utils'
import { workPath } from './const'
import { join } from 'path'
import { isArray } from 'radash'

type ListItemType = RuleSetRule | Plugin

export type RspackExperiments = {
  import: Record<string, unknown>[]
}

export class BaseCreate<T extends ListItemType> {
  protected list: T[] = []
  protected env: 'development' | 'none' | 'production' = 'development'
  protected mode: string = ''
  protected isDev = true
  constructor({
    env = 'development',
    mode = '',
  }: {
    env: 'development' | 'none' | 'production'
    mode?: string
  }) {
    this.env = env
    this.mode = mode
    this.isDev = env === 'development'
  }

  add(item: T | T[] | undefined): this {
    if (isArray(item)) {
      this.list = this.list.concat(item)
    } else {
      if (item) {
        this.list.push(item)
      }
    }
    return this
  }

  end(): T[] {
    return this.list
  }
}

export class CreateLoader extends BaseCreate<RuleSetRule> {
  constructor({
    env = 'development',
    mode = '',
  }: {
    env: 'development' | 'none' | 'production'
    mode?: string
  }) {
    super({ env, mode })
  }
  private defaultScriptLoader = (rspackExperiments?: RspackExperiments) => {
    return {
      test: /\.m?[jt]s$/,
      loader: 'builtin:swc-loader',
      options: {
        sourceMap: this.isDev,
        jsc: {
          parser: {
            syntax: 'typescript',
          },
        },
        rspackExperiments,
      },
      type: 'javascript/auto',
    }
  }
  private defaultResourceLoader: RuleSetRule[] = [
    {
      test: /\.(png|jpe?g|gif|svg|ico)(\?.*)?$/,
      type: 'asset/resource',
      generator: {
        filename: this.isDev ? '[id][ext]' : 'assets/img/[contenthash][ext]',
      },
    },
    {
      test: /\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/,
      type: 'asset/resource',
      generator: {
        filename: this.isDev ? '[id][ext]' : 'assets/media/[contenthash][ext]',
      },
    },
    {
      test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
      type: 'asset/resource',
      generator: {
        filename: this.isDev ? '[id][ext]' : 'assets/fonts/[contenthash][ext]',
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
  constructor({
    env = 'development',
    mode = '',
  }: {
    env: 'development' | 'none' | 'production'
    mode?: string
  }) {
    super({ env, mode })
  }
  useDefaultEnvPlugin(otherEnv?: DefinePluginOptions): this {
    this.add(
      createEnvPlugin({
        otherEnv,
        mode: this.mode,
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
              context: join(workPath, 'public'),
              from: './',
              noErrorOnMissing: true,
              globOptions: {
                ignore: ['.*'],
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
        template: templatePath ?? join(workPath, 'index.html'),
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
      meta: Record<string, any>
    }
  }
}
export class CreateMpaAssets {
  protected pages: Pages
  constructor(pages: Pages) {
    this.pages = pages
  }
  create() {
    const entries: Entry = {}
    const plugins: Plugin[] = []
    Object.keys(this.pages).forEach((page) => {
      entries[page] = {
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
    })

    return {
      entry: entries,
      plugins,
    }
  }
}
