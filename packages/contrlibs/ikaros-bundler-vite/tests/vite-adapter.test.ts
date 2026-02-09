import { describe, expect, it } from 'vitest'

import { ViteBundlerAdapter } from '../src/vite-adapter'
import type { CreateConfigParams } from '../src/types'

const createMinimalParams = (
  overrides?: Partial<CreateConfigParams>,
): CreateConfigParams => ({
  command: 'server',
  env: {},
  context: '/test/project',
  pages: {
    index: {
      html: '/test/project/index.html',
      entry: '/test/project/src/index.ts',
    },
  },
  base: '/',
  port: 3000,
  isElectron: false,
  resolveContext: (...paths: string[]) => `/test/project/${paths.join('/')}`,
  ...overrides,
})

describe('ViteBundlerAdapter', () => {
  it('should have name = "vite"', () => {
    const adapter = new ViteBundlerAdapter()
    expect(adapter.name).toBe('vite')
  })

  it('should create config without throwing', () => {
    const adapter = new ViteBundlerAdapter()
    const config = adapter.createConfig(createMinimalParams())
    expect(config).toBeDefined()
    expect(config.root).toBe('/test/project')
  })

  it('should create config for build command', () => {
    const adapter = new ViteBundlerAdapter()
    const config = adapter.createConfig(
      createMinimalParams({ command: 'build' }),
    )
    expect(config).toBeDefined()
    expect(config.server).toBeUndefined()
  })

  it('should accept all CreateConfigParams fields', () => {
    const adapter = new ViteBundlerAdapter()
    const config = adapter.createConfig(
      createMinimalParams({
        mode: 'production',
        browserslist: 'defaults',
        isVue: true,
        isReact: false,
        contextPkg: { name: 'my-app', version: '2.0.0' },
        userConfig: {
          define: { __APP__: 'test' },
          resolve: { alias: { '~': '/custom' } },
          build: { sourceMap: true, cache: true },
          vite: { plugins: [] },
        },
      }),
    )
    expect(config).toBeDefined()
    expect(config.mode).toBe('production')
    expect(config.resolve?.alias).toHaveProperty('~', '/custom')
  })
})
