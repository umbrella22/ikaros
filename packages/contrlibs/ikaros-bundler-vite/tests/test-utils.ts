import type { BuildPlan, CreateConfigParams, NormalizedConfig } from '../src/types'

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<unknown>
    ? T[K]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K]
}

export const resolveTestContext = (...paths: string[]) =>
  ['/test/project', ...paths].join('/')

export const createNormalizedConfig = (
  overrides?: DeepPartial<NormalizedConfig>,
): NormalizedConfig => {
  const base: NormalizedConfig = {
    bundler: 'vite',
    quiet: false,
    pages: {
      index: {
        html: '/test/project/index.html',
        entry: '/test/project/src/index.ts',
      },
    },
    enablePages: false,
    define: {},
    resolve: {
      alias: {
        '@': '/test/project/src',
      },
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
    },
    server: {
      port: 3000,
      proxy: undefined,
      https: false,
    },
    build: {
      base: '/',
      assetsDir: '',
      gzip: false,
      sourceMap: false,
      outDirName: 'dist',
      outReport: false,
      cache: false,
      dependencyCycleCheck: false,
    },
    vite: {
      plugins: [],
      config: {},
      configFile: false,
    },
    library: null,
    base: '/',
    port: 3000,
    isElectron: false,
  }

  const build = {
    ...base.build,
    ...(overrides?.build ?? {}),
  }

  const server = {
    ...base.server,
    ...(overrides?.server ?? {}),
  }

  return {
    ...base,
    ...overrides,
    pages: {
      ...base.pages,
      ...(overrides?.pages ?? {}),
    } as NormalizedConfig['pages'],
    define: {
      ...base.define,
      ...(overrides?.define ?? {}),
    },
    resolve: {
      ...base.resolve,
      ...(overrides?.resolve ?? {}),
      alias: {
        ...base.resolve.alias,
        ...(overrides?.resolve?.alias ?? {}),
      } as NormalizedConfig['resolve']['alias'],
      extensions: overrides?.resolve?.extensions ?? base.resolve.extensions,
    },
    server,
    build,
    vite: {
      ...base.vite,
      ...(overrides?.vite ?? {}),
    },
    base: overrides?.base ?? build.base,
    port: overrides?.port ?? server.port,
    isElectron: overrides?.isElectron ?? base.isElectron,
  }
}

export const createMinimalParams = (
  overrides?: Omit<Partial<CreateConfigParams>, 'config'> & {
    config?: DeepPartial<NormalizedConfig>
  },
): CreateConfigParams => {
  const config = createNormalizedConfig(overrides?.config)

  return {
    command: 'server',
    env: {},
    context: '/test/project',
    contextPkg: { name: 'test-app', version: '1.0.0' },
    resolveContext: resolveTestContext,
    ...overrides,
    config,
  }
}

export const createMinimalPlan = (
  overrides?: Omit<Partial<CreateConfigParams>, 'config'> & {
    config?: DeepPartial<NormalizedConfig>
  },
): BuildPlan => {
  const params = createMinimalParams(overrides)
  const framework = 'none' as const

  return {
    id: 'web',
    command: params.command,
    platform: params.config.isElectron ? 'desktopClient' : 'web',
    target: params.config.isElectron ? 'electron-renderer' : 'web',
    bundler: 'vite',
    mode: params.mode,
    context: params.context,
    env: params.env,
    entries: Object.fromEntries(
      Object.entries(params.config.pages).map(([name, page]) => [
        name,
        {
          html: page.html,
          import: page.entry ?? '',
        },
      ]),
    ),
    source: {
      define: params.config.define as never,
      alias: params.config.resolve.alias,
      extensions: params.config.resolve.extensions,
      framework,
      browserslist: 'defaults',
    },
    dev: {
      port: params.config.port,
      proxy: params.config.server.proxy,
      https: params.config.server.https,
      pages: params.config.enablePages ?? false,
    },
    output: {
      base: params.config.base,
      dir: params.config.build.outDirName,
      assetsDir: params.config.build.assetsDir,
      gzip: params.config.build.gzip,
      sourceMap: params.config.build.sourceMap,
      report: params.config.build.outReport,
      cache: params.config.build.cache,
      checkCycles: params.config.build.dependencyCycleCheck,
    },
    library: params.config.library ?? undefined,
    adapterOptions: {
      vite: {
        plugins: params.config.vite?.plugins,
        config: params.config.vite?.config ?? {},
        configFile: params.config.vite?.configFile ?? false,
      },
    },
    capabilities: [],
    provenance: [],
    diagnostics: [],
  }
}
