import path from 'node:path'
import { promises as fsp } from 'node:fs'
import type { Configuration } from '@rspack/core'

import type {
  PlatformAdapter,
  PlatformPlanContext,
  PlatformRunContext,
  CompileContext,
  BuildStatus,
  BuildPlan,
  BuildPlanExecutor,
  AdapterLogger,
} from '@ikaros-cli/ikaros/adapter'

import { runDesktopClientDev, runDesktopClientBuild } from '../runner'

const disableOutputClean = (config: Configuration): Configuration => {
  const output = config.output
  if (!output || typeof output !== 'object') return config

  if ('clean' in output && output.clean) {
    return { ...config, output: { ...output, clean: false } }
  }

  return config
}

const tryCleanDir = async (
  logger: AdapterLogger,
  dir: string | undefined,
) => {
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
      logger.warning({
        text: `清理目录失败 ${dir}: ${err instanceof Error ? err.message : String(err)}`,
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

const uniqueDirs = (dirs: Array<string | undefined>): string[] => [
  ...new Set(dirs.filter((dir): dir is string => Boolean(dir))),
]

/**
 * 找出主进程 rspack 配置的输出目录。
 * 主进程配置 target 为 'electron-main',产物文件名为 main.js。
 */
const findMainOutputDir = (configs: Configuration[]): string | undefined => {
  const mainConfig =
    configs.find((c) => c.target === 'electron-main') ??
    configs.find(
      (c) =>
        c.output &&
        typeof c.output === 'object' &&
        c.output.filename === 'main.js',
    )
  return mainConfig ? extractOutputPath(mainConfig) : undefined
}


const cleanOutputDirs = async (
  logger: AdapterLogger,
  configs: Configuration[],
): Promise<void> => {
  const outputDirs = collectOutputDirs(configs)
  await Promise.all(outputDirs.map((dir) => tryCleanDir(logger, dir)))
}

const resolveRendererOutputDir = (
  ctx: CompileContext,
  plan: BuildPlan,
): string => {
  const electronOutDir = plan.electron?.build?.outDir
  if (electronOutDir) {
    return ctx.resolveContext(electronOutDir, 'renderer')
  }

  return ctx.resolveContext('dist/electron/renderer')
}

const asRspackConfigs = (config: unknown): Configuration[] => {
  return Array.isArray(config)
    ? (config as Configuration[])
    : [config as Configuration]
}

const asSingleRspackConfig = (
  config: unknown,
  target: string,
): Configuration => {
  const configs = asRspackConfigs(config)
  if (configs.length !== 1) {
    throw new Error(`[ikaros] ${target} plan should create one Rspack config`)
  }
  return configs[0]
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
  extraOutputDirs: string[] = [],
): Promise<void> => {
  if (!shouldBuildHotUpdateResources(ctx)) return

  const resourcesDir = ctx.resolveContext('build/resources')
  const resourcesDistDir = path.join(resourcesDir, 'dist')

  await fsp.rm(resourcesDistDir, { recursive: true, force: true })
  await fsp.mkdir(resourcesDistDir, { recursive: true })

  for (const dir of uniqueDirs([...collectOutputDirs(configs), ...extraOutputDirs])) {
    const name = path.basename(dir)
    await fsp.cp(dir, path.join(resourcesDistDir, name), {
      recursive: true,
      force: true,
      errorOnExist: false,
    })
  }

  // 主进程产物被复制到 resourcesDistDir/<主进程输出目录名>/main.js。
  // package.json 的 main 字段需相对 resourcesDir 指向该复制后的位置,
  // 而非指向构建输出目录(后者并不会随热更新资源分发)。
  const mainOutputDir = findMainOutputDir(configs)
  const mainName = mainOutputDir ? path.basename(mainOutputDir) : 'main'
  const mainEntry = path.join(resourcesDistDir, mainName, 'main.js')

  await writeJson(path.join(resourcesDir, 'package.json'), {
    name: ctx.contextPkg?.name,
    version: ctx.contextPkg?.version,
    main: path.relative(resourcesDir, mainEntry),
    dependencies: collectPackageDependencies(ctx.contextPkg),
  })
}

const runBuildLifecycle = async <T>(
  logger: AdapterLogger,
  task: () => Promise<T>,
): Promise<T> => {
  logger.info({ text: '开始构建 Electron 应用...' })
  console.time('Electron 构建耗时')
  try {
    return await task()
  } finally {
    console.timeEnd('Electron 构建耗时')
  }
}

export class ElectronDesktopPlatform implements PlatformAdapter {
  readonly name = 'desktopClient' as const

  async createPlans(ctx: PlatformPlanContext): Promise<BuildPlan[]> {
    const { command, compileContext, config } = ctx
    const base = {
      command,
      platform: 'desktopClient' as const,
      mode: compileContext.options.mode,
      context: compileContext.context,
      env: compileContext.env,
      entries: {},
      source: {
        define: config.define,
        alias: config.resolve.alias,
        extensions: config.resolve.extensions,
        framework: config.isReact
          ? ('react' as const)
          : config.isVue
            ? ('vue' as const)
            : ('none' as const),
        browserslist: config.browserslist,
      },
      dev: {
        port: config.port,
        proxy: config.server.proxy,
        https: config.server.https,
        pages: config.enablePages,
      },
      output: {
        base: config.base,
        dir: config.build.outDirName,
        assetsDir: config.build.assetsDir,
        gzip: config.build.gzip,
        sourceMap: config.build.sourceMap,
        report: config.build.outReport,
        cache: config.build.cache,
        checkCycles: config.build.dependencyCycleCheck,
      },
      library: config.library ?? undefined,
      electron: config.electron,
      adapterOptions: {
        rspack: {
          plugins: config.rspack.plugins,
          swc: config.rspack.swc,
          loaders: config.rspack.loaders,
          experiments: config.rspack.experiments,
          moduleFederation: config.rspack.moduleFederation,
          cdn: config.rspack.cdnOptions,
          css: config.rspack.css,
        },
        vite: {
          plugins: config.vite.plugins,
          config: config.vite.config,
          configFile: config.vite.configFile,
        },
      },
      capabilities: [],
      provenance: [
        {
          source: 'electron-platform',
          operation: 'create',
          message: 'created electron build plan',
        },
      ],
      diagnostics: [],
    }

    return [
      {
        ...base,
        id: 'electron-main',
        target: 'electron-main',
        bundler: 'rspack',
      },
      {
        ...base,
        id: 'electron-preload',
        target: 'electron-preload',
        bundler: 'rspack',
      },
      {
        ...base,
        id: 'electron-renderer',
        target: 'electron-renderer',
        bundler: config.bundler,
        entries: Object.fromEntries(
          Object.entries(config.pages).map(([name, page]) => [
            name,
            {
              import: page.entry,
              html: page.html,
              library: page.library,
              options: page.options,
            },
          ]),
        ),
      },
    ]
  }

  async run(params: PlatformRunContext): Promise<void> {
    const { command, plans } = params
    const mainPlan = plans.find((plan) => plan.target === 'electron-main')
    const preloadPlan = plans.find((plan) => plan.target === 'electron-preload')
    const rendererPlan = plans.find((plan) => plan.target === 'electron-renderer')
    if (!mainPlan) {
      throw new Error('[ikaros] electron main plan is missing')
    }
    if (!preloadPlan) {
      throw new Error('[ikaros] electron preload plan is missing')
    }
    if (!rendererPlan) {
      throw new Error('[ikaros] electron renderer plan is missing')
    }

    if (command === 'server') {
      await this.dev(params, {
        mainPlan,
        preloadPlan,
        rendererPlan,
      })
    } else {
      await this.build(params, {
        mainPlan,
        preloadPlan,
        rendererPlan,
      })
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
    params: PlatformRunContext,
    plans: {
      mainPlan: BuildPlan
      preloadPlan: BuildPlan
      rendererPlan: BuildPlan
    },
  ): Promise<void> {
    const { compileContext: ctx, executor, logger } = params
    const { mainPlan, preloadPlan, rendererPlan } = plans
    logger.info({ text: '🚀 开始启动 Electron 开发环境...' })

    try {
      const mainConfig = asSingleRspackConfig(
        await executor.createConfig(mainPlan),
        mainPlan.id,
      )
      const preloadConfigs = asRspackConfigs(
        await executor.createConfig(preloadPlan),
      )

      let mainPreloadWatchPromise: Promise<unknown> | undefined
      let mainOnBuildStatus: ((status: BuildStatus) => void) | undefined
      let preloadOnBuildStatus: ((status: BuildStatus) => void) | undefined

      const startMainPreloadWatchOnce = () => {
        if (!mainPreloadWatchPromise) {
          mainPreloadWatchPromise = this.watchMainAndPreload(
            executor,
            mainConfig,
            preloadConfigs,
            {
              onBuildStatus: (status) => {
                mainOnBuildStatus?.(status)
                preloadOnBuildStatus?.(status)
              },
              registerCleanup: ctx.registerCleanup,
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
        inspectPort: ctx.userConfig?.electron?.build?.inspectPort,
        electronArgs: ctx.userConfig?.electron?.build?.electronArgs,

        startRendererDev: () => {
          return new Promise<number>((resolve, reject) => {
            executor
              .runDev(rendererPlan, {
                port: rendererPlan.dev.port,
                onBuildStatus: (status) => {
                  if (status.success) {
                    resolve(status.port ?? rendererPlan.dev.port)
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

      logger.done({ text: '🎉 Electron 开发环境启动完成！' })
    } catch (err) {
      logger.error({ text: `❌ Electron 开发环境启动失败: ${err}` })
      throw err
    }
  }

  private async build(
    params: PlatformRunContext,
    plans: {
      mainPlan: BuildPlan
      preloadPlan: BuildPlan
      rendererPlan: BuildPlan
    },
  ): Promise<void> {
    const { compileContext: ctx, executor, logger } = params
    const { mainPlan, preloadPlan, rendererPlan } = plans
    await runBuildLifecycle(logger, async () => {
      const mainConfig = asSingleRspackConfig(
        await executor.createConfig(mainPlan),
        mainPlan.id,
      )
      const preloadConfigs = asRspackConfigs(
        await executor.createConfig(preloadPlan),
      )

      const rendererConfig = await executor.createConfig(rendererPlan)

      let unionBuild = false
      let builtConfigs: Configuration[] = []
      const extraHotUpdateDirs: string[] = []

      await runDesktopClientBuild({
        buildMain: async () => {
          const safeMainConfig = disableOutputClean(mainConfig)
          const safePreloadConfigs = preloadConfigs.map(disableOutputClean)

          if (rendererPlan.bundler === 'rspack') {
            const safeRendererConfigs =
              asRspackConfigs(rendererConfig).map(disableOutputClean)
            const unionConfigs = [
              safeMainConfig,
              ...safePreloadConfigs,
              ...safeRendererConfigs,
            ]

            await cleanOutputDirs(logger, unionConfigs)

            await executor.runBuildConfig('rspack', unionConfigs, {
              onBuildStatus: ctx.onBuildStatus,
            })
            unionBuild = true
            builtConfigs = unionConfigs
            return
          }

          const mainPreloadConfigs = [safeMainConfig, ...safePreloadConfigs]
          await cleanOutputDirs(logger, mainPreloadConfigs)

          await this.runRspackConfigsWithExecutor(
            executor,
            mainPreloadConfigs,
            ctx,
          )
          builtConfigs = mainPreloadConfigs
        },

        buildPreload: async () => undefined,

        buildRenderer: async () => {
          if (unionBuild) return

          await executor.runBuild(rendererPlan, {
            onBuildStatus: ctx.onBuildStatus,
          })
          extraHotUpdateDirs.push(resolveRendererOutputDir(ctx, rendererPlan))
        },
      })

      await prepareHotUpdateResources(ctx, builtConfigs, extraHotUpdateDirs)
    })

    logger.done({ text: '🎉 Electron 应用构建完成！' })
  }

  private async watchMainAndPreload(
    executor: BuildPlanExecutor,
    mainConfig: Configuration,
    preloadConfigs: Configuration[],
    options: {
      onBuildStatus?: (status: BuildStatus) => void
      registerCleanup?: (cleanup: () => Promise<void> | void) => void
    },
  ): Promise<void> {
    const safeMainConfig = disableOutputClean(mainConfig)
    const safePreloadConfigs = preloadConfigs.map(disableOutputClean)

    await executor.watchBuildConfig('rspack', [safeMainConfig, ...safePreloadConfigs], {
      onBuildStatus: options.onBuildStatus,
      registerCleanup: options.registerCleanup,
    })
  }

  private async runRspackConfigsWithExecutor(
    executor: BuildPlanExecutor,
    configs: Configuration[],
    ctx: CompileContext,
  ): Promise<void> {
    await executor.runBuildConfig('rspack', configs, {
      onBuildStatus: ctx.onBuildStatus,
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
