import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'

import { isFunction } from 'es-toolkit'
import { isObject } from 'es-toolkit/compat'

import type { ImportMetaBaseEnv } from '../../../types/env'
import type { ConfigEnvPre, UserConfig } from '../../user-config'
import { configSchema } from '../../utils/common-tools'
import { getEnv } from '../../utils/env-tools'
import { resolveConfig } from '../../utils/load-config'

export type PackageJson = {
  name: string
  version: string
}

/** 命令 */
export enum Command {
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
  onBuildStatus?: (status: {
    success: boolean
    port?: number
    message?: string
  }) => void
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
  /** 用户配置 */
  public userConfig?: UserConfig

  /** 工作目录的 package.json */
  private set contextPkg(val: PackageJson | undefined) {
    this._contextPkg = val
  }
  public get contextPkg() {
    return this._contextPkg
  }
  /** 是否为electron环境 */
  public get isElectron() {
    return this.options.platform === 'desktopClient'
  }

  constructor(parame: CompileServeParame) {
    const { command, options, configFile } = parame
    this.command = command
    this.options = options
    this.configFile = configFile
    this.context = process.cwd()
    this.contextRequire = createRequire(join(this.context, './'))
  }

  static async create<
    T extends BaseCompileService,
    P extends CompileServeParame,
  >(this: new (params: P) => T, params: P): Promise<T> {
    const instance = new this(params)
    await instance.initialize()
    return instance
  }

  private async initialize() {
    await this.initContextPkg()
    await this.initEnv()
    await this.loadUserConfig()
    await this.onAfterConfigLoaded()
    await this.startCompile()
  }

  protected async onAfterConfigLoaded(): Promise<void> {}

  /** 基于工作目录的定位 */
  protected resolveContext = (...paths: string[]) => {
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

  private async loadUserConfig() {
    this.userConfig = await this.getUserConfig()
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
   */
  protected async getUserConfig(): Promise<UserConfig | undefined> {
    const { configFile } = this
    const tempConfig = await resolveConfig({ configFile })
    if (tempConfig) {
      if (isFunction(tempConfig)) {
        const opts: ConfigEnvPre = {
          mode: this.options.mode ?? '',
          env: {
            ...this.env,
            PLATFORM: this.options.platform,
            MODE: this.options.mode ?? this.env?.MODE,
          },
          command: this.command,
        }
        return configSchema.parse(await tempConfig(opts))
      }
      if (isObject(tempConfig)) {
        return configSchema.parse(tempConfig as UserConfig)
      }
    }
  }

  protected async startCompile() {
    switch (this.command) {
      case Command.SERVER: {
        await this.dev()
        break
      }
      case Command.BUILD: {
        await this.build()
        break
      }
      default: {
        break
      }
    }
  }

  /** 生命周期抽象方法：dev 启动 */
  protected abstract dev(): unknown | Promise<unknown>

  /** 生命周期抽象方法：build 启动 */
  protected abstract build(): unknown | Promise<unknown>
}
