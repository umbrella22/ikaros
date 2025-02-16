import { createRequire } from 'node:module'
import type { ConfigEnvPre, UserConfig } from '../user-config'
import { join } from 'path'
import type { ImportMetaBaseEnv } from '../../types/env'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { configSchema } from '../utils/common-tools'
import { resolveConfig } from '../utils/load-config'
import { isFunction, isObject } from 'radash'
import { getEnv } from '../utils/env-tools'

export type PackageJson = {
  name: string
  version: string
}

/** 命令 */
export const enum Command {
  SERVER = 'server',
  BUILD = 'build',
}
/** 命令选项 */
export type CompileOptions = {
  /** 模式 */
  readonly mode?: string

  /** 平台 */
  readonly platform: ImportMetaBaseEnv['PLATFORM']
}
export type CompileServeParame = {
  command: Command
  options: CompileOptions
  configFile?: string
}

export abstract class BaseCompileService {
  /** 构建类型 */
  readonly command: Command
  /** cli上下文空间 */
  readonly context: string
  /** 选项 */
  readonly options: CompileOptions
  /** 基于工作目录的Require */
  readonly contextRequire: NodeRequire
  private _env!: ConfigEnvPre['env']
  /** 配置文件 */
  readonly configFile?: string
  /** env */
  private set env(val: ConfigEnvPre['env']) {
    this._env = val
  }
  public get env() {
    return this._env
  }
  private _contextPkg?: PackageJson

  /** 工作目录的 package.json */
  private set contextPkg(val: PackageJson | undefined) {
    this._contextPkg = val
  }
  public get contextPkg() {
    return this._contextPkg
  }

  constructor(parame: CompileServeParame) {
    const { command, options, configFile } = parame
    this.command = command
    this.options = options
    this.configFile = configFile
    this.context = join(process.cwd(), './')
    this.contextRequire = createRequire(this.context)
    this.initialize()
  }

  private async initialize() {
    await this.initContextPkg()
    await this.initEnv()
    this.startCompile()
  }

  /** 基于工作目录的定位 */
  protected resolveContext(...paths: string[]) {
    return join(this.context, ...paths)
  }

  private async initContextPkg() {
    const filePath = this.resolveContext('package.json')

    try {
      await fsp.access(filePath, fs.constants.F_OK)
    } catch {
      return
    }

    this.contextPkg = JSON.parse(
      await fsp.readFile(filePath, {
        encoding: 'utf8',
      }),
    ) as PackageJson
  }

  private async initEnv() {
    const { platform, mode } = this.options

    const retain: ConfigEnvPre['env'] = {
      PLATFORM: platform,
      MODE: mode,
    }
    const envData = await getEnv(mode)
    this.env = {
      ...retain,
      ...envData,
    }
  }
  /** 检索工作目录的模块路径 */
  protected resolveContextModule(id: string): string | undefined {
    try {
      return this.contextRequire.resolve(id)
    } catch {
      return undefined
    }
  }

  /** 加载模块工作目录的模块 */
  protected loadContextModule<T>(id: string): T {
    return this.contextRequire(id)
  }
  /**
   * 获取配置文件
   * @param configFile 配置文件路径
   * @returns
   */
  protected async getUserConfig(): Promise<UserConfig | undefined> {
    const { configFile } = this
    const tempConfig = await resolveConfig({ configFile })
    let fileConfig: UserConfig | undefined = undefined
    if (tempConfig) {
      if (isFunction(tempConfig)) {
        const retain: ConfigEnvPre['env'] = {
          PLATFORM: this.options.platform,
        }
        const opts: ConfigEnvPre = {
          mode: this.options.mode ?? '',
          env: Object.assign(retain, this.env),
          command: this.command,
        }
        fileConfig = await tempConfig(opts)
      }
      if (isObject(tempConfig)) {
        fileConfig = tempConfig
      }

      return configSchema.parse(fileConfig)
    }
  }

  protected startCompile() {
    switch (this.command) {
      case Command.SERVER: {
        this.dev?.()
        break
      }
      case Command.BUILD: {
        this.build?.()
        break
      }
      default: {
        break
      }
    }
  }
  /**
   * 生命周期抽象方法
   * dev 启动
   */
  protected dev?(): void

  /**
   * 生命周期抽象方法
   * build 启动
   */
  protected build?(): void
}
