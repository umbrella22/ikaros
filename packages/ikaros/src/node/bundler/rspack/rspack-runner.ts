// bundler/rspack/rspack-runner.ts — Rspack 编译运行器

import type {
  DevServer,
  Configuration,
  WatchOptions,
  StatsValue,
} from '@rspack/core'
import { rspack } from '@rspack/core'
import { RspackDevServer } from '@rspack/dev-server'

type StatsLike = {
  hasErrors: () => boolean
  toString: (options: StatsValue) => string
}

type RspackWatchingLike = {
  close: (callback: (error?: Error | null) => void) => void
}

import type { BuildStatus } from '../types'
import type { CleanupFn } from '../../watchdog/cleanup-registry'

export type RunRspackBuildOptions = {
  onBuildStatus?: (status: BuildStatus) => void
}

export type WatchRspackBuildOptions = WatchOptions & {
  onBuildStatus?: (status: BuildStatus) => void
  registerCleanup?: (cleanup: CleanupFn) => void
}

export type StartRspackDevServerOptions = {
  port?: number
  onBuildStatus?: (status: BuildStatus) => void
  registerCleanup?: (cleanup: CleanupFn) => void
}

function formatRspackErrors(stats: StatsLike): string {
  const details = stats
    .toString({ chunks: false, colors: true })
    .split(/\r?\n/)
    .map((line) => `    ${line}`)
    .join('\n')
  return `Build failed with errors.\n${details}\n`
}

export function runRspackBuild(
  config: Configuration | Configuration[],
  options?: WatchRspackBuildOptions,
): Promise<string | undefined> {
  const { onBuildStatus } = options ?? {}

  return new Promise<string | undefined>((resolve, reject) => {
    const compiler = rspack(config)

    compiler.run((err, stats) => {
      compiler.close((closeError) => {
        const error =
          err && closeError
            ? new AggregateError(
                [err, closeError],
                `Build failed: ${err.message}; Close failed: ${closeError.message}`,
              )
            : err || closeError
        if (error) {
          onBuildStatus?.({
            success: false,
            message: error.message || 'build error',
          })
          return reject(error)
        }

        if (stats?.hasErrors()) {
          const errorMessage = formatRspackErrors(stats)
          onBuildStatus?.({
            success: false,
            message: errorMessage,
          })
          return reject(new Error(errorMessage))
        }

        const buildResult = stats?.toString({
          chunks: false,
          colors: true,
        })

        onBuildStatus?.({
          success: true,
          message: buildResult,
        })

        return resolve(buildResult)
      })
    })
  })
}

export async function startRspackDevServer(
  config: Configuration,
  options?: StartRspackDevServerOptions,
): Promise<void> {
  const { port, onBuildStatus, registerCleanup } = options ?? {}

  const compiler = rspack(config)
  const server = new RspackDevServer(config.devServer as DevServer, compiler)

  registerCleanup?.(async () => {
    await server.stop()
  })

  await new Promise<void>((resolve, reject) => {
    server.startCallback((err) => {
      if (err) {
        onBuildStatus?.({
          success: false,
          port,
          message: err.message,
        })
        return reject(err)
      }

      onBuildStatus?.({
        success: true,
        port,
      })

      return resolve()
    })
  })
}

export function watchRspackBuild(
  config: Configuration | Configuration[],
  options?: WatchRspackBuildOptions,
): Promise<string | undefined> {
  const { onBuildStatus, registerCleanup, ...watchOptions } = options ?? {}

  return new Promise<string | undefined>((resolve, reject) => {
    const compiler = rspack(config)
    let settled = false
    let closed = false
    let watching: RspackWatchingLike | undefined
    let pendingClose: ((watching: RspackWatchingLike) => void) | undefined

    const closeWatchingOnce = (
      onClose: (error?: Error | null) => void,
    ) => {
      if (closed) {
        onClose()
        return
      }

      const close = (instance: RspackWatchingLike) => {
        closed = true
        instance.close((closeError?: Error | null) => {
          onClose(closeError)
        })
      }

      if (watching) {
        close(watching)
        return
      }

      pendingClose = close
    }

    watching = compiler.watch(
      {
        ignored: /node_modules/,
        aggregateTimeout: 300,
        poll: false,
        ...watchOptions,
      },
      (err, stats) => {
        if (err) {
          onBuildStatus?.({
            success: false,
            message: err.message || 'watch build error',
          })
          if (!settled) {
            settled = true
            closeWatchingOnce((closeError) => {
              if (closeError) {
                reject(
                  new AggregateError(
                    [err, closeError],
                    `Watch build failed: ${err.message}; Close failed: ${closeError.message}`,
                  ),
                )
                return
              }
              reject(err)
            })
          }
          return undefined
        }

        if (stats?.hasErrors()) {
          const errorMessage = formatRspackErrors(stats)
          onBuildStatus?.({
            success: false,
            message: errorMessage,
          })
          if (!settled) {
            settled = true
            const error = new Error(errorMessage)
            closeWatchingOnce((closeError) => {
              if (closeError) {
                reject(
                  new AggregateError(
                    [error, closeError],
                    `Watch build failed: ${errorMessage}; Close failed: ${closeError.message}`,
                  ),
                )
                return
              }
              reject(error)
            })
          }
          return undefined
        }

        const buildResult = stats?.toString({
          chunks: false,
          colors: true,
        })

        onBuildStatus?.({
          success: true,
          message: buildResult,
        })

        if (!settled) {
          settled = true
          resolve(buildResult)
        }
        return undefined
      },
    )

    pendingClose?.(watching)
    pendingClose = undefined

    registerCleanup?.(
      () =>
        new Promise<void>((resolveClose, rejectClose) => {
          closeWatchingOnce((closeError) => {
            if (closeError) {
              rejectClose(closeError)
              return
            }
            resolveClose()
          })
        }),
    )
  })
}

export type RspackCompiler = ReturnType<typeof rspack>

export function createRspackCompiler(
  config: Configuration | Configuration[],
): RspackCompiler {
  return rspack(config)
}
