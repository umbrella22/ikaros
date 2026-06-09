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

const disableOutputClean = (config: Configuration): Configuration => {
  const output = config.output
  if (!output || typeof output !== 'object') return config

  if ('clean' in output && output.clean) {
    return { ...config, output: { ...output, clean: false } }
  }

  return config
}

const tryCleanDir = async (dir: string | undefined) => {
  if (!dir) return
  try {
    await fsp.rm(dir, { recursive: true, force: true })
  } catch (err: unknown) {
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

const extractOutputPath = (config: Configuration): string | undefined => {
  return config.output &&
    typeof config.output === 'object' &&
    'path' in config.output
    ? (config.output.path as string | undefined)
    : undefined
}

const collectOutputDirs = (configs: Configuration[]): string[] => {
  return [
    ...new Set(
      configs
        .map(extractOutputPath)
        .filter((dir): dir is string => Boolean(dir)),
    ),
  ]
}

const cleanOutputDirs = async (configs: Configuration[]): Promise<void> => {
  const outputDirs = collectOutputDirs(configs)
  await Promise.all(outputDirs.map((dir) => tryCleanDir(dir)))
}

const asRspackConfigs = (config: unknown): Configuration[] => {
  return Array.isArray(config)
    ? (config as Configuration[])
    : [config as Configuration]
}

const isControlledRestartEnabled = (ctx: CompileContext): boolean => {
  return Boolean(ctx.userConfig?.electron?.build?.debug)
}

const shouldBuildHotUpdateResources = (ctx: CompileContext): boolean => {
  return Boolean(ctx.userConfig?.electron?.build?.hotReload)
}

const writeJson = async (filePath: string, data: unknown): Promise<void> => {
  await fsp.mkdir(path.dirname(filePath), { recursive: true })
  await fsp.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`)
}

const collectPackageDependencies = (
  pkg: CompileContext['contextPkg'],
): Record<string, string> | undefined => {
  if (!pkg || typeof pkg !== 'object') return undefined
  const deps = (pkg as { dependencies?: Record<string, string> }).dependencies
  return deps && typeof deps === 'object' ? deps : undefined
}

const prepareHotUpdateResources = async (
  ctx: CompileContext,
  configs: Configuration[],
): Promise<void> => {
  if (!shouldBuildHotUpdateResources(ctx)) return

  const outputRoot =
    ctx.userConfig?.electron?.build?.outDir ??
    ctx.resolveContext('dist/electron')
  const resourcesDir = ctx.resolveContext('build/resources')
  const resourcesDistDir = path.join(resourcesDir, 'dist')

  await fsp.rm(resourcesDistDir, { recursive: true, force: true })
  await fsp.mkdir(resourcesDistDir, { recursive: true })

  for (const dir of collectOutputDirs(configs)) {
    const name = path.basename(dir)
    await fsp.cp(dir, path.join(resourcesDistDir, name), {
      recursive: true,
      force: true,
      errorOnExist: false,
    })
  }

  await writeJson(path.join(resourcesDir, 'package.json'), {
    name: ctx.contextPkg?.name,
    version: ctx.contextPkg?.version,
    main: path.relative(
      resourcesDir,
      ctx.resolveContext(outputRoot, 'main/main.js'),
    ),
    dependencies: collectPackageDependencies(ctx.contextPkg),
  })
}

const runBuildLifecycle = async <T>(task: () => Promise<T>): Promise<T> => {
  info({ text: '🔨 开始构建 Electron 应用...' })
  console.time('Electron 构建耗时')
  try {
    return await task()
  } finally {
    console.timeEnd('Electron 构建耗时')
  }
}

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

      const rendererConfig = await bundler.createConfig({
        command: 'server',
        mode: ctx.options.mode,
        env: ctx.env,
        context: ctx.context,
        contextPkg: ctx.contextPkg,
        config: preConfig,
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
        registerCleanup: ctx.registerCleanup,
        controlledRestart: isControlledRestartEnabled(ctx),

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
                registerCleanup: ctx.registerCleanup,
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

  private async build(
    bundler: BundlerAdapter,
    ctx: CompileContext,
    preConfig: PlatformPreConfig,
  ): Promise<void> {
    await runBuildLifecycle(async () => {
      const configParams = this.createConfigFactoryParams(ctx)

      const mainConfig = await createElectronMainRspackConfig(configParams)
      const preloadEntries =
        await createElectronPreloadRspackConfigs(configParams)
      const preloadConfigs = preloadEntries.map((e) => e.config)

      const rendererConfig = await bundler.createConfig({
        command: 'build',
        mode: ctx.options.mode,
        env: ctx.env,
        context: ctx.context,
        contextPkg: ctx.contextPkg,
        config: preConfig,
        resolveContext: ctx.resolveContext,
        preWarnings: ctx.preWarnings,
      })

      let unionBuild = false
      let builtConfigs: Configuration[] = []

      await runDesktopClientBuild({
        buildMain: async () => {
          const safeMainConfig = disableOutputClean(mainConfig)
          const safePreloadConfigs = preloadConfigs.map(disableOutputClean)

          if (bundler.name === 'rspack') {
            const safeRendererConfigs =
              asRspackConfigs(rendererConfig).map(disableOutputClean)
            const unionConfigs = [
              safeMainConfig,
              ...safePreloadConfigs,
              ...safeRendererConfigs,
            ]

            await cleanOutputDirs(unionConfigs)

            await runRspackBuild(unionConfigs, {
              onBuildStatus: ctx.onBuildStatus,
            })
            unionBuild = true
            builtConfigs = unionConfigs
            return
          }

          const mainPreloadConfigs = [safeMainConfig, ...safePreloadConfigs]
          await cleanOutputDirs(mainPreloadConfigs)

          await runRspackBuild(mainPreloadConfigs, {
            onBuildStatus: ctx.onBuildStatus,
          })
          builtConfigs = mainPreloadConfigs
        },

        buildPreload: async () => undefined,

        buildRenderer: async () => {
          if (unionBuild) return

          await bundler.runBuild(rendererConfig, {
            onBuildStatus: ctx.onBuildStatus,
          })
        },
      })

      await prepareHotUpdateResources(ctx, builtConfigs)
    })

    done({ text: '🎉 Electron 应用构建完成！' })
  }

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

export const ElectronDesktopPlatformInstance = new ElectronDesktopPlatform()
