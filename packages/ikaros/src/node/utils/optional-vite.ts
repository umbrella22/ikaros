export type OptionalViteAdapter = {
  createWebViteConfig: (params: {
    command: 'server' | 'build'
    mode?: string
    env: Record<string, unknown>
    context: string
    userConfig?: Record<string, unknown>
    pages: Record<string, { html: string; entry: string }>
    base: string
    port: number
    isElectron: boolean
    resolveContext: (...paths: string[]) => string
  }) => unknown

  runViteBuild: (
    config: unknown,
    options?: {
      onBuildStatus?: (status: {
        success: boolean
        port?: number
        message?: string
      }) => void
    },
  ) => Promise<string | undefined>

  startViteDevServer: (
    config: unknown,
    options?: {
      port?: number
      onBuildStatus?: (status: {
        success: boolean
        port?: number
        message?: string
      }) => void
    },
  ) => Promise<unknown>
}

const createMissingViteError = (): Error => {
  const pkg = '@ikaros-cli/ikaros-bundler-vite'
  const lines = [
    `你启用了 bundler='vite'，但未安装可选依赖 ${pkg}。`,
    '',
    '请安装后重试：',
    `  pnpm add -D ${pkg}`,
  ]
  return new Error(lines.join('\n'))
}

const createNodeTooOldForViteError = (): Error => {
  const lines = [
    "你启用了 bundler='vite'，但当前 Node.js 版本过低。",
    `当前版本：v${process.versions.node}`,
    'Vite 7 运行时通常需要 Node.js >= 22。',
  ]
  return new Error(lines.join('\n'))
}

export const loadOptionalViteAdapter = (params: {
  loadContextModule: <T>(id: string) => T
}): OptionalViteAdapter => {
  const { loadContextModule } = params

  const majorVersion = Number(process.versions.node.split('.')[0])
  if (Number.isFinite(majorVersion) && majorVersion < 22) {
    throw createNodeTooOldForViteError()
  }

  try {
    const mod = loadContextModule<
      | OptionalViteAdapter
      | { default?: OptionalViteAdapter }
      | {
          createWebViteConfig?: OptionalViteAdapter['createWebViteConfig']
          runViteBuild?: OptionalViteAdapter['runViteBuild']
          startViteDevServer?: OptionalViteAdapter['startViteDevServer']
        }
    >('@ikaros-cli/ikaros-bundler-vite')

    const adapter =
      (mod as { default?: OptionalViteAdapter }).default ??
      (mod as OptionalViteAdapter)

    if (
      typeof adapter?.createWebViteConfig !== 'function' ||
      typeof adapter?.runViteBuild !== 'function' ||
      typeof adapter?.startViteDevServer !== 'function'
    ) {
      throw createMissingViteError()
    }

    return adapter
  } catch (err) {
    // 统一对外报“缺失可选依赖”，避免泄漏底层 resolve 细节
    if (err instanceof Error) {
      throw createMissingViteError()
    }
    throw createMissingViteError()
  }
}
