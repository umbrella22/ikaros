import { type RspackPluginInstance, type Compiler, rspack } from '@rspack/core'
import type { JsAlterAssetTagsData, JsHtmlPluginTag } from '@rspack/binding'
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

type InternalCdnPluginOptions = CdnPluginOptions & {
  context?: string
}

const PLUGIN_NAME = '@rspack/ikaros-cdn-plugin'
const DEFAULT_PROD_URL = 'https://unpkg.com/:name@:version/:path'
const DEFAULT_DEV_URL = ':name/:path'
const PARAM_REGEX = /:([a-z]+)/i

/**
 * 从 CDN 配置中提取 externals 映射
 *
 * 将 externals 的处理从插件运行时提升到配置阶段，
 * 避免在 apply() 中直接修改 compiler.options，符合 rspack 插件最佳实践。
 *
 * @param modules - CDN 模块列表
 * @returns externals 映射对象，可直接传给 rspack config 的 externals 字段
 */
export function createCdnExternals(
  modules: CdnModule[],
): Record<string, string> {
  return modules
    .filter((m) => !m.cssOnly)
    .reduce(
      (acc, m) => {
        acc[m.name] = m.var || m.name
        return acc
      },
      {} as Record<string, string>,
    )
}

export default class CdnPlugin implements RspackPluginInstance {
  private options: CdnPluginOptions
  private isDev: boolean = false
  private versionCache = new Map<string, string>()
  private readonly context: string

  constructor(options: InternalCdnPluginOptions) {
    this.context = options.context ?? process.cwd()
    this.options = {
      prodUrl: DEFAULT_PROD_URL,
      devUrl: DEFAULT_DEV_URL,
      crossOrigin: false,
      ...options,
    }
  }

  public apply(compiler: Compiler): void {
    this.isDev = compiler.options.mode === 'development'

    // 注册 HTML 标签注入（externals 已在配置阶段处理，此处只负责注入资源标签）
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

  private injectResources(data: JsAlterAssetTagsData): void {
    const modules = this.options.modules
    const tags: JsHtmlPluginTag[] = []

    for (const module of modules) {
      const styles = this.getAssets(module, 'style', 'styles')
      for (const style of styles) {
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
      }
    }

    for (const module of modules) {
      if (module.cssOnly) continue
      const scripts = this.getAssets(module, 'path', 'paths')
      for (const script of scripts) {
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
      }
    }

    // 将标签插入到现有资源之前
    if (data.assetTags) {
      data.assetTags.styles.unshift(...tags.filter((t) => t.tagName === 'link'))
      data.assetTags.scripts.unshift(
        ...tags.filter((t) => t.tagName === 'script'),
      )
    }
  }

  private getAssets(
    module: CdnModule,
    singularKey: 'style' | 'path',
    pluralKey: 'styles' | 'paths',
  ): string[] {
    const items = [...(module[pluralKey] || [])]
    const singular = module[singularKey]
    if (singular) {
      items.unshift(singular)
    }
    return items.map((item) => this.generateUrl(module, item))
  }
  private joinUrl(base: string, urlPath: string): string {
    return `${base.replace(/\/+$/, '')}/${urlPath.replace(/^\/+/, '')}`
  }

  private generateUrl(module: CdnModule, path: string): string {
    const url = this.isDev
      ? module.devUrl || this.options.devUrl
      : module.prodUrl || this.options.prodUrl

    // 如果URL中没有模板参数，使用 joinUrl 处理拼接
    if (!PARAM_REGEX.test(url!)) {
      return this.joinUrl(url!, path)
    }

    return url!.replace(/:([a-z]+)/gi, (match, param) => {
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
    const cached = this.versionCache.get(name)
    if (cached) return cached

    try {
      const version = createRequire(path.join(this.context, './'))(
        path.join(name, 'package.json'),
      ).version as string
      this.versionCache.set(name, version)
      return version
    } catch {
      // eslint-disable-next-line no-console
      console.warn(
        chalk.yellow(
          `[${PLUGIN_NAME}] 无法获取模块 "${name}" 的版本信息，将回退使用 "latest"（生产环境下不推荐，请显式指定 version）`,
        ),
      )
      return 'latest'
    }
  }
}
