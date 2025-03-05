import {
  type RuleSetRule,
  type DefinePluginOptions,
  type Plugin,
  rspack,
  type Entry,
  type RspackPluginInstance,
} from '@rspack/core'

import { buildCssLoaders, type CssLoaderOptions } from './css-loaders-helper'
import { workPath } from './const'
import { join } from 'path'
import { isArray, isEmpty } from 'radash'
import { getEnv } from './env-tools'
import { warningLog } from './logger'

type ListItemType = RuleSetRule | Plugin

export type RspackExperiments = {
  import: Record<string, any>[]
}

type OtherEnv = {
  frameworkEnv?: DefinePluginOptions
  extEnv?: DefinePluginOptions
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
      item && this.list.push(item)
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
      test: /\.m?[j]s$/,
      loader: 'builtin:swc-loader',
      options: {
        sourceMap: this.isDev,
        isModule: 'unknown',
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
  useDefaultEnvPlugin(otherEnv?: OtherEnv): this {
    const { frameworkEnv = {}, extEnv = {} } = otherEnv ?? {}

    this.add(
      createEnvPlugin({
        frameworkEnv,
        extEnv,
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
  protected enablePages: string[] | false | undefined
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
    Object.keys(this.pages).forEach((page) => {
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
    })

    return {
      entry,
      plugins,
    }
  }
  protected getEnablePages() {
    if (!isEmpty(this.pages) && isArray(this.enablePages)) {
      const reMakePage: Pages = {}
      // 预留未找到的数组，以便后续给出错误提示
      const notFoundPageName: string[] = []
      this.enablePages.forEach((item) => {
        if (this.pages[item]) {
          reMakePage[item] = this.pages[item]
        } else {
          notFoundPageName.push(item)
        }
      })
      notFoundPageName.length &&
        warningLog(`当前设置页面${notFoundPageName.join()}不存在`)

      // 当出现错误的页面导致没有任何选中时，将使用userConfig中的pages，不做任何处理
      if (isEmpty(reMakePage)) {
        return
      }
      this.pages = reMakePage
    }
  }
}

const createEnvPlugin = ({
  mode,
  frameworkEnv = {},
  extEnv = {}, // 扩展的环境变量
}: {
  mode?: string
  frameworkEnv?: DefinePluginOptions
  extEnv?: DefinePluginOptions
}): RspackPluginInstance => {
  const baseEnv = Object.assign({}, extEnv, getEnv(mode))
  const clientEnvs = Object.fromEntries(
    Object.entries(baseEnv).map(([key, val]) => {
      return [`import.meta.env.${key}`, JSON.stringify(val)]
    }),
  )
  const envs = Object.fromEntries(
    Object.entries({ ...clientEnvs, ...frameworkEnv }).map(([key, val]) => {
      return [key, val]
    }),
  )
  return new rspack.DefinePlugin(envs)
}
