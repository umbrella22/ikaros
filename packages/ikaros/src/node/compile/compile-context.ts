// compile/compile-context.ts — 编译上下文

import fsp from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'

import { isFunction } from 'es-toolkit'
import { isObject } from 'es-toolkit/compat'

import type { ImportMetaBaseEnv } from '../../types/env'
import type {
  ConfigEnvPre,
  ResolvedUserConfig,
  UserConfig,
} from '../config/user-config'
import { configSchema } from '../config/config-schema'
import { getEnv, type EnvDiagnostics } from '../config/env-loader'
import { resolveConfig } from '../config/config-loader'
import type { BuildStatus } from '../bundler/types'
import type { PreWarning } from '../plugins/pre-warnings-plugin'
import type { CleanupFn } from '../watchdog/cleanup-registry'

// ─── 公共类型 ─────────────────────────────────────────────────────────────

export type PackageJson = {
  name: string
  version: string
}

export type CompileEnvInfo = EnvDiagnostics

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

export type CompileServeParams = {
  command: Command
  options: CompileOptions
  configFile?: string
  /** 工作目录，默认 process.cwd() */
  context?: string
  onBuildStatus?: (status: BuildStatus) => void
  /** dev 生命周期中用于注册清理函数 */
  registerCleanup?: (cleanup: CleanupFn) => void
}

// ─── CompileContext 接口 ────────────────────────────────────────────────────

/**
 * 编译上下文
 *
 * 由 createCompileContext() 工厂函数创建，以组合方式提供给 Platform/Bundler 使用。
 */
export interface CompileContext {
  /** 工作目录 */
  readonly context: string
  /** 命令 */
  readonly command: Command
  /** CLI 选项 */
  readonly options: CompileOptions
  /** 环境变量 */
  readonly env: Record<string, unknown>
  /** 用户配置（可在 modifyIkarosConfig 阶段被插件更新为 ResolvedUserConfig） */
  userConfig?: UserConfig | ResolvedUserConfig
  /** 工作目录 package.json */
  readonly contextPkg?: PackageJson
  /** 基于工作目录的路径解析 */
  readonly resolveContext: (...paths: string[]) => string
  /** 加载工作目录模块 */
  readonly loadContextModule: <T>(id: string) => T
  /** 检索工作目录模块路径 */
  readonly resolveContextModule: (id: string) => string | undefined
  /** 基于工作目录的 require（供需要完整 NodeRequire 的场景使用） */
  readonly contextRequire: NodeRequire
  /** 是否 Electron */
  readonly isElectron: boolean
  /** 配置文件路径 */
  readonly configFile?: string
  /** 构建状态回调 */
  onBuildStatus?: (status: BuildStatus) => void
  /** 实例级清理函数注册能力 */
  readonly registerCleanup?: (cleanup: CleanupFn) => void
  /** 编译器创建前收集的警告，会通过 PreWarningsPlugin 注入 rspack logger */
  readonly preWarnings: PreWarning[]
  /** env 文件链与最终 key 来源信息 */
  readonly envInfo?: CompileEnvInfo
  /** 当前编译轮次注入的 env 清理函数 */
  readonly envCleanup: () => void
}

// ─── 工厂函数 ───────────────────────────────────────────────────────────────

/**
 * 创建编译上下文
 *
 * 替代 BaseCompileService 的构造函数 + initialize() 流程：
 * 1. 设置工作目录和选项
 * 2. 加载 package.json
 * 3. 加载环境变量
 * 4. 加载并验证用户配置
 */
export async function createCompileContext(
  params: CompileServeParams,
): Promise<CompileContext> {
  const { command, options, configFile, onBuildStatus, registerCleanup } =
    params
  const context = params.context ?? process.cwd()
  const contextRequire = createRequire(join(context, './'))

  const resolveContext = (...paths: string[]) => join(context, ...paths)

  const loadContextModule = <T>(id: string): T => contextRequire(id)

  const resolveContextModule = (id: string): string | undefined => {
    try {
      return contextRequire.resolve(id)
    } catch {
      return undefined
    }
  }

  // 1. 加载 package.json
  const contextPkg = await loadContextPkg(resolveContext)

  // 2. 加载环境变量
  const {
    env,
    preWarnings,
    envInfo,
    cleanup: envCleanup,
  } = await loadEnv(options, context)

  let userConfig: UserConfig | undefined
  try {
    // 3. 加载并验证用户配置
    userConfig = await loadUserConfig({
      configFile,
      context,
      options,
      env,
      command,
    })
  } catch (error) {
    envCleanup()
    throw error
  }

  if (command === Command.SERVER) {
    registerCleanup?.(envCleanup)
  }

  return {
    context,
    command,
    options,
    env,
    userConfig,
    contextPkg,
    resolveContext,
    loadContextModule,
    resolveContextModule,
    contextRequire,
    isElectron: options.platform === 'desktopClient',
    configFile,
    onBuildStatus,
    registerCleanup,
    preWarnings,
    envInfo,
    envCleanup,
  }
}

// ─── 内部辅助函数 ───────────────────────────────────────────────────────────

async function loadContextPkg(
  resolveContext: (...paths: string[]) => string,
): Promise<PackageJson | undefined> {
  const filePath = resolveContext('package.json')
  try {
    const content = await fsp.readFile(filePath, 'utf8')
    return JSON.parse(content) as PackageJson
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined
    }
    throw err
  }
}

async function loadEnv(
  options: CompileOptions,
  context: string,
): Promise<{
  env: Record<string, unknown>
  preWarnings: PreWarning[]
  envInfo: CompileEnvInfo
  cleanup: () => void
}> {
  const { platform, mode } = options
  const retain: ConfigEnvPre['env'] = {
    PLATFORM: platform,
    MODE: mode,
  }
  const {
    env: envData,
    warnings,
    filePaths,
    loadedFiles,
    keySources,
    cleanup,
  } = await getEnv(context, mode)

  return {
    // CLI 实际传入的 PLATFORM/MODE 优先级高于 .env 文件，避免被用户配置覆盖
    env: {
      ...envData,
      ...retain,
    },
    preWarnings: warnings,
    envInfo: {
      filePaths,
      loadedFiles,
      keySources,
    },
    cleanup,
  }
}

async function loadUserConfig(params: {
  configFile?: string
  context: string
  options: CompileOptions
  env: Record<string, unknown>
  command: Command
}): Promise<UserConfig | undefined> {
  const { configFile, context, options, env, command } = params

  const tempConfig = await resolveConfig({ configFile, context })
  if (!tempConfig) return undefined

  if (isFunction(tempConfig)) {
    const opts: ConfigEnvPre = {
      mode: options.mode ?? '',
      env: {
        ...(env as ConfigEnvPre['env']),
        PLATFORM: options.platform,
        MODE: options.mode ?? (env as ConfigEnvPre['env'])?.MODE,
      },
      command,
    }
    return configSchema.parse(await tempConfig(opts)) as UserConfig
  }

  if (isObject(tempConfig)) {
    return configSchema.parse(tempConfig as UserConfig) as UserConfig
  }

  return undefined
}
