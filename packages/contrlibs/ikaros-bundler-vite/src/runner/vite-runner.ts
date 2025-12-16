import type { InlineConfig, ViteDevServer } from 'vite'
import { build, createServer } from 'vite'

import type { BuildStatus } from '../types'

export type RunViteBuildOptions = {
  onBuildStatus?: (status: BuildStatus) => void
}

export type StartViteDevServerOptions = {
  port?: number
  onBuildStatus?: (status: BuildStatus) => void
}

const toErrorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message
  return String(err)
}

export const runViteBuild = async (
  config: InlineConfig,
  options?: RunViteBuildOptions,
): Promise<string | undefined> => {
  const { onBuildStatus } = options ?? {}

  try {
    const result = await build({
      ...config,
      configFile: false,
    })

    const outDir = config.build?.outDir
    const message = Array.isArray(result)
      ? `Vite build finished (${result.length} outputs)${outDir ? ` -> ${outDir}` : ''}.`
      : `Vite build finished${outDir ? ` -> ${outDir}` : ''}.`

    onBuildStatus?.({
      success: true,
      message,
    })

    return message
  } catch (err) {
    const message = toErrorMessage(err)
    onBuildStatus?.({
      success: false,
      message,
    })
    throw err
  }
}

export const startViteDevServer = async (
  config: InlineConfig,
  options?: StartViteDevServerOptions,
): Promise<ViteDevServer> => {
  const { port, onBuildStatus } = options ?? {}

  try {
    const server = await createServer({
      ...config,
      configFile: false,
      server: {
        ...(config.server ?? {}),
        port: port ?? config.server?.port,
        strictPort: true,
      },
    })

    await server.listen()

    const resolvedPort = server.config.server.port

    try {
      server.printUrls()
    } catch {
      // ignore
    }

    onBuildStatus?.({
      success: true,
      port: resolvedPort,
    })

    return server
  } catch (err) {
    const message = toErrorMessage(err)
    onBuildStatus?.({
      success: false,
      port,
      message,
    })
    throw err
  }
}
