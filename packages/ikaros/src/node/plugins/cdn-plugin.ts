import { type RspackPluginInstance, type Compiler, rspack } from '@rspack/core'
import { createRequire } from 'node:module'
import chalk from 'chalk'
import path from 'path'

interface CdnModule {
  name: string
  var?: string
  version?: string
  path?: string
  paths?: string[]
  style?: string
  styles?: string[]
  cssOnly?: boolean
  prodUrl?: string
  devUrl?: string
}

export interface CdnPluginOptions {
  modules: CdnModule[]
  prodUrl?: string
  devUrl?: string
  crossOrigin?: boolean | string
}

const PLUGIN_NAME = '@rspack/ikaros-cdn-plugin'
const DEFAULT_PROD_URL = 'https://unpkg.com/:name@:version/:path'
const DEFAULT_DEV_URL = ':name/:path'
const PARAM_REGEX = /:([a-z]+)/gi

export default class CdnPlugin implements RspackPluginInstance {
  private compiler!: Compiler
  private options: CdnPluginOptions
  private isDev: boolean = false

  constructor(options: CdnPluginOptions) {
    this.options = {
      prodUrl: DEFAULT_PROD_URL,
      devUrl: DEFAULT_DEV_URL,
      crossOrigin: false,
      ...options,
    }
  }

  public apply(compiler: Compiler): void {
    this.compiler = compiler
    this.isDev = compiler.options.mode === 'development'

    // 处理外部模块
    this.handleExternals()

    // 注册 HTML 标签注入
    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
      const hooks = rspack.HtmlRspackPlugin.getCompilationHooks(compilation)

      // 注入脚本和样式
      hooks.alterAssetTags.tapAsync(PLUGIN_NAME, (data, cb) => {
        try {
          this.injectResources(data)
          cb(null, data)
        } catch (error) {
          cb(error as Error)
        }
      })
    })
  }

  private handleExternals(): void {
    const externals = this.compiler.options.externals || {}

    this.options.modules
      .filter((m) => !m.cssOnly)
      .forEach((m) => {
        ;(externals as { [key: string]: any })[m.name] = m.var || m.name
      })

    this.compiler.options.externals = externals
  }

  private injectResources(data: any): void {
    const modules = this.options.modules
    const tags: any[] = []

    // 注入 CSS
    modules.forEach((module) => {
      const styles = this.getStyles(module)
      styles.forEach((style) => {
        tags.push({
          tagName: 'link',
          voidTag: true,
          attributes: {
            rel: 'stylesheet',
            href: style,
            ...(this.options.crossOrigin && {
              crossorigin: this.options.crossOrigin,
            }),
          },
        })
      })
    })

    // 注入 JS
    modules
      .filter((m) => !m.cssOnly)
      .forEach((module) => {
        const scripts = this.getScripts(module)
        scripts.forEach((script) => {
          tags.push({
            tagName: 'script',
            voidTag: true,
            attributes: {
              src: script,
              ...(this.options.crossOrigin && {
                crossorigin: this.options.crossOrigin,
              }),
            },
          })
        })
      })

    // 将标签插入到现有资源之前
    if (data.assetTags) {
      data.assetTags.styles.unshift(...tags.filter((t) => t.tagName === 'link'))
      data.assetTags.scripts.unshift(
        ...tags.filter((t) => t.tagName === 'script'),
      )
    }
  }

  private getStyles(module: CdnModule): string[] {
    const styles = [...(module.styles || [])]
    if (module.style) {
      styles.unshift(module.style)
    }
    return styles.map((style) => this.generateUrl(module, style))
  }

  private getScripts(module: CdnModule): string[] {
    const scripts = [...(module.paths || [])]
    if (module.path) {
      scripts.unshift(module.path)
    }
    return scripts.map((script) => this.generateUrl(module, script))
  }
  private joinUrl(base: string, path: string): string {
    // 移除 base 结尾的斜杠和 path 开头的斜杠
    base = base.replace(/\/+$/, '')
    path = path.replace(/^\/+/, '')
    return `${base}/${path}`
  }

  private generateUrl(module: CdnModule, path: string): string {
    const url = this.isDev
      ? module.devUrl || this.options.devUrl
      : module.prodUrl || this.options.prodUrl

    // 如果URL中没有模板参数，使用 joinUrl 处理拼接
    if (!url!.match(PARAM_REGEX)) {
      return this.joinUrl(url!, path)
    }

    return url!.replace(PARAM_REGEX, (match, param) => {
      switch (param) {
        case 'name':
          return module.name
        case 'version':
          return module.version || this.getModuleVersion(module.name)
        case 'path':
          return path
        default:
          return match
      }
    })
  }

  private getModuleVersion(name: string): string {
    try {
      return createRequire(path.join(process.cwd(), 'node_modules'))(
        path.join(name, 'package.json'),
      ).version
    } catch {
      console.warn(
        chalk.yellow(`[${PLUGIN_NAME}] 无法获取模块 "${name}" 的版本信息`),
      )
      return 'latest'
    }
  }
}
