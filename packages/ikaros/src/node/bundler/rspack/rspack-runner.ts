// bundler/rspack/rspack-runner.ts — Rspack 编译运行器

import type {
  DevServer,
  Configuration,
  WatchOptions,
  StatsValue,
} from '@rspack/core'
import { rspack } from '@rspack/core'
import { RspackDevServer } from '@rspack/dev-server'
import { registerCleanup } from '../../watchdog/cleanup-registry'

type StatsLike = {
  hasErrors: () => boolean
  toString: (options: StatsValue) => string
}

import type { BuildStatus } from '../types'

export type RunRspackBuildOptions = {
  onBuildStatus?: (status: BuildStatus) => void
}

export type WatchRspackBuildOptions = WatchOptions & {
  onBuildStatus?: (status: BuildStatus) => void
}

export type StartRspackDevServerOptions = {
  port?: number
  onBuildStatus?: (status: BuildStatus) => void
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
  const { port, onBuildStatus } = options ?? {}

  const compiler = rspack(config)
  const server = new RspackDevServer(config.devServer as DevServer, compiler)

  // 注册看门狗清理：重启前关闭 dev server 释放端口
  registerCleanup(async () => {
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
  const { onBuildStatus, ...watchOptions } = options ?? {}

  return new Promise<string | undefined>((resolve, reject) => {
    const compiler = rspack(config)

    compiler.watch(
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
          return reject(err)
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
      },
    )
  })
}

export type RspackCompiler = ReturnType<typeof rspack>

export function createRspackCompiler(
  config: Configuration | Configuration[],
): RspackCompiler {
  return rspack(config)
}
