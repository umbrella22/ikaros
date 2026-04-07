import type { CreateConfigParams, NormalizedConfig } from '../src/types'

export const resolveTestContext = (...paths: string[]) =>
  ['/test/project', ...paths].join('/')

export const createNormalizedConfig = (
  overrides?: Partial<NormalizedConfig>,
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
    },
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
      },
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
  overrides?: Partial<CreateConfigParams>,
): CreateConfigParams => {
  const config = createNormalizedConfig(overrides?.config)

  return {
    command: 'server',
    env: {},
    context: '/test/project',
    contextPkg: { name: 'test-app', version: '1.0.0' },
    config,
    resolveContext: resolveTestContext,
    ...overrides,
    config,
  }
}
