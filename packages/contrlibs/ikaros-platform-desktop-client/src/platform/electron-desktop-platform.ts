// platform/electron-desktop-platform.ts — Electron Desktop 平台适配器（PlatformAdapter 实现）

import path from 'node:path'
import { promises as fsp } from 'node:fs'
import type { Configuration, DefinePluginOptions } from '@rspack/core'

import {
  type PlatformAdapter,
  type PlatformPreConfig,
  type PlatformCompileParams,
  type CompileContext,
  type BundlerAdapter,
  type BuildStatus,
  resolveWebPreConfig,
  LoggerSystem,
  runRspackBuild,
  watchRspackBuild,
} from '@ikaros-cli/ikaros'

import { runDesktopClientDev, runDesktopClientBuild } from '../runner'
import { createElectronMainRspackConfig } from '../config/main-config'
import { createElectronPreloadRspackConfigs } from '../config/preload-config'

const { info, done, error } = LoggerSystem()

// ─── 辅助函数 ───

/** 禁用 rspack config 的 output.clean，避免 main/preload 共用输出目录时并发 clean 导致冲突 */
const disableOutputClean = (config: Configuration): Configuration => {
  const output = config.output
  if (!output || typeof output !== 'object') return config

  if ('clean' in output && output.clean) {
    return { ...config, output: { ...output, clean: false } }
  }

  return config
}

/** 统一在构建前手动清理一次输出目录 */
const tryCleanDir = async (dir: string | undefined) => {
  if (!dir) return
  try {
    await fsp.rm(dir, { recursive: true, force: true })
  } catch (err: unknown) {
    // ENOENT 表示目录不存在，可安全忽略；其他错误（如权限不足）应给出警告
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      err.code !== 'ENOENT'
    ) {
      info({
        text: `⚠️ 清理目录失败 ${dir}: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }
}

/** 从 rspack config 中提取 output.path */
const extractOutputPath = (config: Configuration): string | undefined => {
  return config.output &&
    typeof config.output === 'object' &&
    'path' in config.output
    ? (config.output.path as string | undefined)
    : undefined
}

/**
 * Electron Desktop 平台适配器
 *
 * 实现 PlatformAdapter 接口，替代原来继承 BaseCompileService 的方式。
 * 通过 compile() 方法接收 CompileContext 和 BundlerAdapter，
 * 编排 main/preload/renderer 三目标的编译流程。
 *
 * - main/preload 始终使用 rspack（node target，不走 BundlerAdapter）
 * - renderer 使用 BundlerAdapter（支持 rspack/vite 切换）
 */
export class ElectronDesktopPlatform implements PlatformAdapter {
  readonly name = 'desktopClient' as const

  async resolvePreConfig(ctx: CompileContext): Promise<PlatformPreConfig> {
    return resolveWebPreConfig({
      command: ctx.command,
      context: ctx.context,
      resolveContext: ctx.resolveContext,
      getUserConfig: async () => ctx.userConfig,
      isElectron: true,
    })
  }

  async compile(
    bundler: BundlerAdapter,
    params: PlatformCompileParams,
  ): Promise<void> {
    const { command, preConfig, compileContext: ctx } = params

    if (command === 'server') {
      await this.dev(bundler, ctx, preConfig)
    } else {
      await this.build(bundler, ctx, preConfig)
    }
  }

  // ─── Dev ──────────────────────────────────────────────────────────────────

  /**
   * 开发模式：
   * 1. 启动 renderer dev server（通过 BundlerAdapter）
   * 2. watch main + preload（始终用 rspack）
   * 3. 启动 Electron 进程
   */
  private async dev(
    bundler: BundlerAdapter,
    ctx: CompileContext,
    preConfig: PlatformPreConfig,
  ): Promise<void> {
    info({ text: '🚀 开始启动 Electron 开发环境...' })

    try {
      const configParams = this.createConfigFactoryParams(ctx)

      const mainConfig = await createElectronMainRspackConfig(configParams)
      const preloadEntries =
        await createElectronPreloadRspackConfigs(configParams)
      const preloadConfigs = preloadEntries.map((e) => e.config)

      // 生成 renderer 编译配置
      const rendererConfig = await bundler.createConfig({
        command: 'server',
        mode: ctx.options.mode,
        env: ctx.env,
        context: ctx.context,
        contextPkg: ctx.contextPkg,
        userConfig: preConfig.userConfig,
        pages: preConfig.pages,
        base: preConfig.base,
        port: preConfig.port,
        browserslist: preConfig.browserslist,
        isElectron: true,
        isVue: preConfig.isVue,
        isReact: preConfig.isReact,
        resolveContext: ctx.resolveContext,
        preWarnings: ctx.preWarnings,
      })

      let mainPreloadWatchPromise: Promise<unknown> | undefined
      let mainOnBuildStatus: ((status: BuildStatus) => void) | undefined
      let preloadOnBuildStatus: ((status: BuildStatus) => void) | undefined

      const startMainPreloadWatchOnce = () => {
        if (!mainPreloadWatchPromise) {
          mainPreloadWatchPromise = this.watchMainAndPreload(
            mainConfig,
            preloadConfigs,
            {
              onBuildStatus: (status) => {
                mainOnBuildStatus?.(status)
                preloadOnBuildStatus?.(status)
              },
            },
          )
        }
        return mainPreloadWatchPromise
      }

      await runDesktopClientDev({
        entryFile: this.resolveMainOutputFile(mainConfig, ctx),
        loadContextModule: ctx.loadContextModule,

        startRendererDev: () => {
          return new Promise<number>((resolve, reject) => {
            bundler
              .runDev(rendererConfig, {
                port: preConfig.port,
                onBuildStatus: (status) => {
                  if (status.success) {
                    resolve(status.port ?? preConfig.port)
                  } else {
                    reject(new Error(status.message))
                  }
                },
              })
              .catch(reject)
          })
        },

        startMainDev: async (options) => {
          mainOnBuildStatus = options?.onBuildStatus
          await startMainPreloadWatchOnce()
        },

        startPreloadDev: async (options) => {
          preloadOnBuildStatus = options?.onBuildStatus
          await startMainPreloadWatchOnce()
        },
      })

      done({ text: '🎉 Electron 开发环境启动完成！' })
    } catch (err) {
      error({ text: `❌ Electron 开发环境启动失败: ${err}` })
      throw err
    }
  }

  // ─── Build ────────────────────────────────────────────────────────────────

  /**
   * 生产构建：
   * - 如果 renderer 也用 rspack → 三合一并行构建（main + preload + renderer）
   * - 如果 renderer 用 vite → main+preload 用 rspack，renderer 用 vite
   */
  private async build(
    bundler: BundlerAdapter,
    ctx: CompileContext,
    preConfig: PlatformPreConfig,
  ): Promise<void> {
    info({ text: '🔨 开始构建 Electron 应用...' })

    const configParams = this.createConfigFactoryParams(ctx)

    const mainConfig = await createElectronMainRspackConfig(configParams)
    const preloadEntries =
      await createElectronPreloadRspackConfigs(configParams)
    const preloadConfigs = preloadEntries.map((e) => e.config)

    // 生成 renderer 编译配置
    const rendererConfig = await bundler.createConfig({
      command: 'build',
      mode: ctx.options.mode,
      env: ctx.env,
      context: ctx.context,
      contextPkg: ctx.contextPkg,
      userConfig: preConfig.userConfig,
      pages: preConfig.pages,
      base: preConfig.base,
      port: preConfig.port,
      browserslist: preConfig.browserslist,
      isElectron: true,
      isVue: preConfig.isVue,
      isReact: preConfig.isReact,
      resolveContext: ctx.resolveContext,
      preWarnings: ctx.preWarnings,
    })

    let unionBuild = false

    await runDesktopClientBuild({
      buildMain: async () => {
        if (bundler.name === 'rspack') {
          // 三合一：main + preload + renderer 一次 rspack 多配置构建
          const safeMainConfig = disableOutputClean(mainConfig)
          const safePreloadConfigs = preloadConfigs.map(disableOutputClean)
          await tryCleanDir(extractOutputPath(safeMainConfig))

          await runRspackBuild(
            [
              safeMainConfig,
              ...safePreloadConfigs,
              rendererConfig as Configuration,
            ],
            { onBuildStatus: ctx.onBuildStatus },
          )
          unionBuild = true
          return
        }

        // rspack 只构建 main + preload（renderer 在 buildRenderer 中执行）
        const safeMainConfig = disableOutputClean(mainConfig)
        await runRspackBuild([safeMainConfig, ...preloadConfigs], {
          onBuildStatus: ctx.onBuildStatus,
        })
      },

      buildPreload: async () => {
        // 已合并到 buildMain，保持兼容占位
      },

      buildRenderer: async () => {
        if (unionBuild) return

        // renderer 使用非 rspack bundler（如 vite）构建
        await bundler.runBuild(rendererConfig, {
          onBuildStatus: ctx.onBuildStatus,
        })
      },
    })

    done({ text: '🎉 Electron 应用构建完成！' })
  }

  // ─── 私有辅助方法 ─────────────────────────────────────────────────────────

  /** 创建配置工厂参数（main/preload 配置共用） */
  private createConfigFactoryParams(ctx: CompileContext) {
    return {
      command: ctx.command,
      mode: ctx.options.mode,
      env: ctx.env as unknown as DefinePluginOptions,
      context: ctx.context,
      contextPkg: ctx.contextPkg,
      userConfig: ctx.userConfig,
      resolveContext: ctx.resolveContext,
    }
  }

  /**
   * watch main + preload（始终用 rspack，node target 不走 BundlerAdapter）
   */
  private async watchMainAndPreload(
    mainConfig: Configuration,
    preloadConfigs: Configuration[],
    options: {
      onBuildStatus?: (status: BuildStatus) => void
    },
  ): Promise<void> {
    const safeMainConfig = disableOutputClean(mainConfig)
    const safePreloadConfigs = preloadConfigs.map(disableOutputClean)

    await watchRspackBuild([safeMainConfig, ...safePreloadConfigs], {
      onBuildStatus: options.onBuildStatus,
    })
  }

  /**
   * 从 main rspack config 派生 main 进程输出文件路径。
   */
  private resolveMainOutputFile(
    mainConfig: Configuration,
    ctx: CompileContext,
  ): string {
    const outDir = extractOutputPath(mainConfig)
    const filePattern =
      mainConfig.output &&
      typeof mainConfig.output === 'object' &&
      'filename' in mainConfig.output
        ? mainConfig.output.filename
        : undefined

    if (!outDir || !filePattern) {
      return ctx.resolveContext('dist/electron/main/main.js')
    }

    const fileName =
      typeof filePattern === 'string'
        ? filePattern.replace('[name]', 'main')
        : 'main.js'

    return path.isAbsolute(outDir)
      ? path.join(outDir, fileName)
      : ctx.resolveContext(outDir, fileName)
  }
}

/**
 * 单例实例，用于 platform-factory 加载
 */
export const ElectronDesktopPlatformInstance = new ElectronDesktopPlatform()
