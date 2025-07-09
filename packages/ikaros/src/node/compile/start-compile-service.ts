import { BaseCompileService, Command } from './base-compile-service'
import { isString } from 'radashi'
import type { UserConfig } from '..'
import type { Pages } from '../utils/loaders-plugins-helper'
import { detect } from 'detect-port'
import chalk from 'chalk'
import { RspackService } from '../engine/rspack-service'
import type { EngineConstructor, ResolvedContext } from '../engine/base-service'
import { checkDependency } from '../utils/common-tools'

// 定义引擎映射
const engineMap: Record<string, EngineConstructor> = {
  rspack: RspackService,
  // webpack: WebpackService,
  // vite: ViteService,
}

export class CompileService extends BaseCompileService {
  /** 用户配置 */
  userConfig?: UserConfig
  /** 基础路径 */
  base!: string
  /** 浏览器兼容列表 */
  browserslist!: string
  isVue: boolean = false
  isReact: boolean = false
  /** 编译目标 */
  target!: 'pc' | 'mobile'
  /** 编译引擎 */
  engine: 'rspack' | 'webpack' | 'vite' = 'rspack'
  /** 端口 */
  port!: number
  /** 页面配置 */
  pages!: Pages

  /** 初始化配置相关 */
  private async initUserConfig() {
    const isDev = this.command === Command.SERVER

    const config = await this.getUserConfig()
    this.userConfig = config

    this.base = config?.build?.base ?? '/'

    if (isDev && isString(this.base) && /^https?:/.test(this.base)) {
      const optsText = chalk.cyan('build.base')
      this.logger.error({
        text: ` 本地开发时 ${optsText} 不应该为外部 Host!`,
      })
      throw new Error(`错误的配置: ${optsText} 不应为外部 Host`)
    }

    this.target = config?.target ?? 'pc'

    this.pages = config?.pages ?? {
      index: {
        html: this.resolveContext('index.html'),
        entry: this.resolveContext('src/index'),
      },
    }

    this.port = await detect(config?.server?.port || '8080')
    this.engine = config?.engine ?? 'rspack'
  }
  /**
   * 初始化browserslist
   */
  private async initBrowserslist() {
    const isMobile = this.target === 'mobile'

    const bl = ['defaults']

    if (isMobile) {
      bl.push('IOS >= 10', 'Chrome >= 51')
    } else {
      bl.push(
        '>=0.1%',
        'Chrome >= 56',
        'Safari >= 10',
        'last 2 versions',
        'not dead',
      )
    }

    this.browserslist = bl.join(',')
  }
  /**
   * 初始化部分前端框架专属配置
   */
  protected async initOtherConfig() {
    try {
      const [hasReact, hasVue] = await Promise.all([
        checkDependency('react'),
        checkDependency('vue'),
      ])
      this.isVue = hasVue
      this.isReact = hasReact
      // 吃掉报错，因为这里只是检查依赖
    } catch {}
  }
  /** 初始化 */
  protected async initPreConfig(): Promise<ResolvedContext> {
    await this.initialize()
    await Promise.all([
      this.initUserConfig(),
      this.initOtherConfig(),
      this.initBrowserslist(),
    ])
    return {
      userConfig: this.userConfig!,
      command: this.command,
      options: this.options,
      context: this.context,
      contextPkg: this.contextPkg,
      version: this.version,
      env: this.env,
      base: this.base,
      port: this.port,
      pages: this.pages,
      browserslist: this.browserslist,
      resolveContext: this.resolveContext.bind(this), // 绑定方法依然需要，但只在这里出现一次
    }
  }
  /** 初始化引擎实例 */
  protected async createEngine() {
    const context = await this.initPreConfig()
    if (!this.userConfig) {
      this.logger.error({
        text: '用户配置未加载，请检查配置文件。',
      })
      throw new Error('userConfig is not loaded')
    }
    const EngineClass = engineMap[this.engine]

    if (!EngineClass) {
      throw new Error(`Unsupported build engine: ${this.engine}`)
    }

    // 3. 实例化选定的引擎，并传入通用上下文
    return new EngineClass(context)
  }
  public async dev(): Promise<void> {
    const engine = await this.createEngine()
    engine.serve()
  }
  public async build(): Promise<void> {
    const engine = await this.createEngine()
    engine.build()
  }
}
