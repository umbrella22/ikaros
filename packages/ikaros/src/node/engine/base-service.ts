import type { DefinePluginOptions, DevServer } from '@rspack/core'
import type { Command, PackageJson } from '../compile/base-compile-service'
import type { UserConfig } from '../user-config'
import type { RspackDevServer } from '@rspack/dev-server'
import { join } from 'node:path'
import { isString } from 'radashi'
import { logger } from '@ikaros-cli/infra-contrlibs'
import { checkDependency } from '../utils/common-tools'

// 配置上下文接口
export interface ResolvedContext {
  userConfig: UserConfig
  command: Command
  options: { mode?: string }
  context: string
  contextPkg?: PackageJson
  version: string
  env: DefinePluginOptions
  base: string
  port: DevServer['port']
  pages: Exclude<UserConfig['pages'], undefined>
  browserslist: string
  resolveContext: (path: string) => string
}

/**
 * 所有构建引擎必须实现的通用接口
 */
export abstract class IEngineService {
  public devServer: RspackDevServer | undefined
  public resolvedContext: ResolvedContext
  public browserslist: string
  public base: string
  public userConfig: UserConfig
  public pages: Exclude<UserConfig['pages'], undefined>
  public port: DevServer['port']
  public logger = logger
  public isVue = false
  public isReact = false

  constructor(resolvedContext: ResolvedContext) {
    this.resolvedContext = resolvedContext
    this.browserslist = resolvedContext.browserslist ?? 'defaults'
    this.base = resolvedContext.base
    this.userConfig = resolvedContext.userConfig
    this.pages = resolvedContext.pages
    this.port = resolvedContext.port
  }

  abstract serve(): Promise<void>
  abstract build(): Promise<void>
  restartServer?(): Promise<void>
  /** 合并资源目录 */
  protected joinAssetsDir(...paths: string[]) {
    const assetsDir = this.userConfig?.build?.assetsDir ?? ''
    return join(assetsDir, ...paths).replaceAll('\\', '/')
  }

  /** 获取输出目录 */
  protected getOutDirPath() {
    const outDirName = this.userConfig?.build?.outDirName
    if (isString(outDirName)) {
      return this.resolvedContext.resolveContext(outDirName)
    }
    return this.resolvedContext.resolveContext('dist')
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
}

/**
 * 引擎构造函数的类型
 */
export type EngineConstructor = new (context: ResolvedContext) => IEngineService
