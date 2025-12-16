export type OptionalDesktopClientAdapter = {
  runDesktopClientDev: (params: {
    entryFile: string
    startRendererDev: () => Promise<number>
    startMainDev: (options?: {
      onBuildStatus?: (status: {
        success: boolean
        port?: number
        message?: string
      }) => void
    }) => Promise<void> | void
    startPreloadDev: (options?: {
      onBuildStatus?: (status: {
        success: boolean
        port?: number
        message?: string
      }) => void
    }) => Promise<void> | void
    loadContextModule: <T>(id: string) => T
    controlledRestart?: boolean
    inspectPort?: number
  }) => Promise<void>

  runDesktopClientBuild: (params: {
    buildMain: () => Promise<unknown>
    buildPreload: () => Promise<unknown>
    buildRenderer: () => Promise<unknown>
  }) => Promise<void>
}

const createMissingDesktopClientAdapterError = (): Error => {
  const pkg = '@ikaros-cli/ikaros-platform-desktop-client'
  const lines = [
    `你启用了 platform='desktopClient'，但未安装可选依赖 ${pkg}。`,
    '',
    '请安装后重试：',
    `  pnpm add -D ${pkg}`,
  ]
  return new Error(lines.join('\n'))
}

export const loadOptionalDesktopClientAdapter = (params: {
  loadContextModule: <T>(id: string) => T
}): OptionalDesktopClientAdapter => {
  const { loadContextModule } = params

  try {
    const mod = loadContextModule<
      | OptionalDesktopClientAdapter
      | { default?: OptionalDesktopClientAdapter }
      | {
          runDesktopClientDev?: OptionalDesktopClientAdapter['runDesktopClientDev']
          runDesktopClientBuild?: OptionalDesktopClientAdapter['runDesktopClientBuild']
        }
    >('@ikaros-cli/ikaros-platform-desktop-client')

    const adapter =
      (mod as { default?: OptionalDesktopClientAdapter }).default ??
      (mod as OptionalDesktopClientAdapter)

    if (
      typeof adapter?.runDesktopClientDev !== 'function' ||
      typeof adapter?.runDesktopClientBuild !== 'function'
    ) {
      throw createMissingDesktopClientAdapterError()
    }

    return adapter
  } catch {
    throw createMissingDesktopClientAdapterError()
  }
}
