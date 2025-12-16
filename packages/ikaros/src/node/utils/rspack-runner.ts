import type { DevServer, Configuration, WatchOptions } from '@rspack/core'
import { rspack } from '@rspack/core'
import { RspackDevServer } from '@rspack/dev-server'

type StatsLike = {
  hasErrors: () => boolean
  toString: (options: any) => string
}

export type BuildStatus = {
  success: boolean
  port?: number
  message?: string
}

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

const formatRspackErrors = (stats: StatsLike): string => {
  let errorMessage = 'Build failed with errors.\n'
  stats
    .toString({
      chunks: false,
      colors: true,
    })
    .split(/\r?\n/)
    .forEach((line) => {
      errorMessage += `    ${line}\n`
    })
  return errorMessage
}

export const runRspackBuild = (
  config: Configuration | Configuration[],
  options?: WatchRspackBuildOptions,
): Promise<string | undefined> => {
  const { onBuildStatus } = options ?? {}

  return new Promise<string | undefined>((resolve, reject) => {
    const compiler = rspack(config)

    compiler.run((err, stats) => {
      compiler.close((closeError) => {
        const error = err || closeError
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

export const startRspackDevServer = async (
  config: Configuration,
  options?: StartRspackDevServerOptions,
): Promise<void> => {
  const { port, onBuildStatus } = options ?? {}

  const compiler = rspack(config)
  const server = new RspackDevServer(config.devServer as DevServer, compiler)

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

export const watchRspackBuild = (
  config: Configuration | Configuration[],
  options?: WatchRspackBuildOptions,
): Promise<string | undefined> => {
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

export const createRspackCompiler = (
  config: Configuration | Configuration[],
): RspackCompiler => {
  return rspack(config)
}
