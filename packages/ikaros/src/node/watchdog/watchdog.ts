// watchdog/watchdog.ts — 看门狗：监听 env 与配置文件变更，自动重启服务

import { isAbsolute, join, relative, resolve } from 'node:path'

import chokidar from 'chokidar'

import { resolveConfigWatchFiles } from '../config/config-loader'
import { getEnvDir, getEnvFiles } from '../config/env-loader'
import { LoggerSystem } from '../shared/logger'
import { CONFIG_FILE_NAME, CONFIG_FILE_SUFFIXES } from '../shared/constants'

const logger = LoggerSystem()

type WatchdogEvent = 'add' | 'change' | 'unlink'

const DEFAULT_AWAIT_WRITE_FINISH = {
  stabilityThreshold: 200,
  pollInterval: 50,
} as const

type ChokidarWatchOptions = Parameters<typeof chokidar.watch>[1]

export type WatchdogRestartReason = {
  file: string
  event: WatchdogEvent
}

export type WatchdogTrackedFileKind = 'config' | 'env'

export type ResolveWatchdogWatchPlanOptions = Pick<
  WatchdogOptions,
  'context' | 'configFile' | 'mode'
>

export type WatchdogWatchPlan = {
  envDir: string
  envFiles: string[]
  configEntryFiles: string[]
  configDependencyFiles: string[]
  trackedFiles: string[]
  watchedPaths: string[]
  fileCategories: Record<string, WatchdogTrackedFileKind>
}

export type WatchdogOptions = {
  /** 项目根目录 */
  context: string
  /** 自定义配置文件路径 */
  configFile?: string
  /** 当前 mode，用于推导实际生效的 env 文件 */
  mode?: string
  /** 变更后触发的重启回调 */
  onRestart: (reason: WatchdogRestartReason) => Promise<void>
  /** 防抖延迟（毫秒），默认 1000 */
  debounceMs?: number
  /** chokidar 监听选项 */
  watchOptions?: ChokidarWatchOptions
}

export type WatchdogInstance = {
  /** 关闭看门狗，停止文件监听 */
  close: () => Promise<void>
}

function resolveConfigEntryFiles(
  options: ResolveWatchdogWatchPlanOptions,
): string[] {
  const { context, configFile } = options

  if (configFile) {
    return [resolveWatchPath(context, configFile)]
  }

  return CONFIG_FILE_SUFFIXES.map((suffix) =>
    resolveWatchPath(context, join(context, `${CONFIG_FILE_NAME}.${suffix}`)),
  )
}

function createFileCategories(params: {
  envFiles: string[]
  configEntryFiles: string[]
  configDependencyFiles: string[]
}): Record<string, WatchdogTrackedFileKind> {
  const { envFiles, configEntryFiles, configDependencyFiles } = params
  const fileCategories: Record<string, WatchdogTrackedFileKind> = {}

  for (const filePath of envFiles) {
    fileCategories[filePath] = 'env'
  }

  for (const filePath of [...configEntryFiles, ...configDependencyFiles]) {
    fileCategories[filePath] = 'config'
  }

  return fileCategories
}

function buildWatchdogWatchPlan(
  options: ResolveWatchdogWatchPlanOptions & {
    configDependencyFiles: string[]
  },
): WatchdogWatchPlan {
  const { context, mode, configDependencyFiles } = options
  const envDir = resolveWatchPath(context, getEnvDir(context))
  const envFiles = getEnvFiles(context, mode).map((filePath) =>
    resolveWatchPath(context, filePath),
  )
  const configEntryFiles = resolveConfigEntryFiles(options)
  const resolvedConfigDependencyFiles = configDependencyFiles.map((filePath) =>
    resolveWatchPath(context, filePath),
  )
  const trackedFiles = [
    ...new Set([
      ...configEntryFiles,
      ...envFiles,
      ...resolvedConfigDependencyFiles,
    ]),
  ]

  return {
    envDir,
    envFiles,
    configEntryFiles,
    configDependencyFiles: resolvedConfigDependencyFiles,
    trackedFiles,
    watchedPaths: [...new Set([...trackedFiles, envDir])],
    fileCategories: createFileCategories({
      envFiles,
      configEntryFiles,
      configDependencyFiles: resolvedConfigDependencyFiles,
    }),
  }
}

export async function resolveWatchdogWatchPlan(
  options: ResolveWatchdogWatchPlanOptions,
): Promise<WatchdogWatchPlan> {
  const configDependencyFiles = await resolveConfigWatchFiles({
    context: options.context,
    configFile: options.configFile,
  })

  return buildWatchdogWatchPlan({
    ...options,
    configDependencyFiles,
  })
}

export function classifyWatchdogRestartReason(
  reason: WatchdogRestartReason,
  plan: Pick<WatchdogWatchPlan, 'fileCategories'>,
): WatchdogTrackedFileKind | undefined {
  return plan.fileCategories[reason.file]
}

/**
 * 创建看门狗实例
 *
 * 监听：
 * - 项目根目录下的 ikaros.config.{ts,mjs,json,yaml}
 * - env/ 目录中的所有 .env 文件
 *
 * 当上述文件发生变更时，执行 onRestart 回调（清理资源 → 重新编译）。
 */
export function createWatchdog(options: WatchdogOptions): WatchdogInstance {
  const {
    context,
    configFile,
    mode,
    onRestart,
    debounceMs = 1000,
    watchOptions,
  } = options

  const baseWatchPlan = buildWatchdogWatchPlan({
    context,
    configFile,
    mode,
    configDependencyFiles: [],
  })

  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let isClosed = false
  let isRestarting = false
  let pendingRestart: WatchdogRestartReason | null = null
  let currentWatchPlan = baseWatchPlan
  let trackedFiles = new Set(baseWatchPlan.trackedFiles)
  let watchedPaths = new Set(baseWatchPlan.watchedPaths)

  const { awaitWriteFinish, ...otherWatchOptions } = watchOptions ?? {}

  const watcher = chokidar.watch([...watchedPaths], {
    ignoreInitial: true,
    ignorePermissionErrors: true,
    awaitWriteFinish: awaitWriteFinish ?? DEFAULT_AWAIT_WRITE_FINISH,
    ...otherWatchOptions,
  })

  const refreshWatchTargets = async () => {
    const nextWatchPlan = await resolveWatchdogWatchPlan({
      context,
      configFile,
      mode,
    })
    const nextTrackedFiles = new Set(nextWatchPlan.trackedFiles)
    const nextWatchedPaths = new Set(nextWatchPlan.watchedPaths)

    const addedPaths = [...nextWatchedPaths].filter(
      (filePath) => !watchedPaths.has(filePath),
    )
    const removedPaths = [...watchedPaths].filter(
      (filePath) => !nextWatchedPaths.has(filePath),
    )

    currentWatchPlan = nextWatchPlan
    trackedFiles = nextTrackedFiles
    watchedPaths = nextWatchedPaths

    if (isClosed) {
      return
    }
    if (addedPaths.length > 0) {
      watcher.add(addedPaths)
    }
    if (removedPaths.length > 0) {
      await watcher.unwatch(removedPaths)
    }
  }

  const triggerRestart = (reason: WatchdogRestartReason) => {
    const formattedReason = formatRestartReason(
      context,
      reason,
      currentWatchPlan,
    )

    if (isClosed) {
      logger.info({
        text: `看门狗已关闭，忽略变更事件: ${formattedReason}`,
      })
      return
    }

    if (isRestarting) {
      pendingRestart = reason
      return
    }
    if (debounceTimer) clearTimeout(debounceTimer)

    debounceTimer = setTimeout(async () => {
      if (isClosed) return

      debounceTimer = null
      isRestarting = true
      logger.info({
        text: `检测到 ${formattedReason}，正在重启整个服务...`,
      })

      try {
        await onRestart(reason)
        logger.done({
          text: `服务已重启，原因: ${formattedReason}`,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.error({
          text: `重启失败 (${formattedReason}): ${message}`,
        })
      } finally {
        try {
          await refreshWatchTargets()
        } catch (err) {
          if (isClosed) {
            return
          }
          const message = err instanceof Error ? err.message : String(err)
          logger.warning({ text: `刷新监听目标失败: ${message}` })
        }

        isRestarting = false

        if (isClosed) {
          if (pendingRestart) {
            logger.info({
              text: `看门狗已关闭，丢弃挂起重启: ${formatRestartReason(context, pendingRestart, currentWatchPlan)}`,
            })
          }
          pendingRestart = null
          return
        }

        // 重启期间有新的变更，补做一次尾部重启
        if (pendingRestart) {
          const nextReason = pendingRestart
          pendingRestart = null
          triggerRestart(nextReason)
        }
      }
    }, debounceMs)
  }

  const handleWatchEvent = (event: WatchdogEvent, filePath: string) => {
    const resolvedPath = resolveWatchPath(context, filePath)
    if (!trackedFiles.has(resolvedPath)) {
      return
    }

    triggerRestart({
      file: resolvedPath,
      event,
    })
  }

  watcher.on('change', (filePath) => handleWatchEvent('change', filePath))
  watcher.on('add', (filePath) => handleWatchEvent('add', filePath))
  watcher.on('unlink', (filePath) => handleWatchEvent('unlink', filePath))
  watcher.on('ready', () => {
    logger.info({ text: '看门狗已就绪，正在监听配置文件和环境变量变更...' })
  })
  watcher.on('error', (err) => {
    const message = err instanceof Error ? err.message : String(err)
    logger.error({ text: `看门狗监听异常: ${message}` })
  })

  logger.info({ text: '看门狗已启动，正在初始化监听目标...' })
  void refreshWatchTargets().catch((err) => {
    if (isClosed) {
      return
    }
    const message = err instanceof Error ? err.message : String(err)
    logger.warning({ text: `初始化监听目标失败: ${message}` })
  })

  return {
    close: async () => {
      isClosed = true
      pendingRestart = null

      await watcher.close()
      if (debounceTimer) {
        clearTimeout(debounceTimer)
        debounceTimer = null
      }
    },
  }
}

function resolveWatchPath(context: string, filePath: string): string {
  return isAbsolute(filePath) ? filePath : resolve(context, filePath)
}

function formatRestartReason(
  context: string,
  reason: WatchdogRestartReason,
  plan?: Pick<WatchdogWatchPlan, 'fileCategories'>,
): string {
  const displayPath = relative(context, reason.file) || reason.file
  const category = plan
    ? classifyWatchdogRestartReason(reason, plan)
    : undefined

  return category
    ? `${displayPath} (${reason.event}, ${category})`
    : `${displayPath} (${reason.event})`
}
