import { describe, expect, it } from 'vitest'

import { createViteConfig } from '../src/config/create-vite-config'
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

describe('createViteConfig', () => {
  it('should not throw with minimal params', () => {
    expect(() => createViteConfig(createMinimalParams())).not.toThrow()
  })

  it('should set root to context', () => {
    const config = createViteConfig(createMinimalParams())
    expect(config.root).toBe('/test/project')
  })

  it('should set base from params', () => {
    const config = createViteConfig(createMinimalParams({ base: '/app/' }))
    expect(config.base).toBe('/app/')
  })

  it('should set mode from params', () => {
    const config = createViteConfig(createMinimalParams({ mode: 'production' }))
    expect(config.mode).toBe('production')
  })

  it('should configure dev server for command=server', () => {
    const config = createViteConfig(
      createMinimalParams({ command: 'server', port: 5173 }),
    )
    expect(config.server).toBeDefined()
    expect(config.server?.port).toBe(5173)
    expect(config.server?.strictPort).toBe(true)
  })

  it('should not configure server for command=build', () => {
    const config = createViteConfig(createMinimalParams({ command: 'build' }))
    expect(config.server).toBeUndefined()
  })

  it('should set appType to spa for single page', () => {
    const config = createViteConfig(createMinimalParams())
    expect(config.appType).toBe('spa')
  })

  it('should set appType to mpa for multiple pages', () => {
    const config = createViteConfig(
      createMinimalParams({
        pages: {
          index: { html: '/index.html', entry: '/src/index.ts' },
          about: { html: '/about.html', entry: '/src/about.ts' },
        },
      }),
    )
    expect(config.appType).toBe('mpa')
  })

  it('should set default @ alias', () => {
    const config = createViteConfig(createMinimalParams())
    expect(config.resolve?.alias).toHaveProperty('@', '/test/project/src')
  })

  it('should merge user aliases with default', () => {
    const config = createViteConfig(
      createMinimalParams({
        userConfig: {
          resolve: { alias: { '~': '/custom/path' } },
        },
      }),
    )
    expect(config.resolve?.alias).toHaveProperty('@', '/test/project/src')
    expect(config.resolve?.alias).toHaveProperty('~', '/custom/path')
  })

  it('should set outDir for electron renderer', () => {
    const config = createViteConfig(createMinimalParams({ isElectron: true }))
    expect(config.build?.outDir).toBe('/test/project/dist/electron/renderer')
  })

  it('should set custom outDir', () => {
    const config = createViteConfig(
      createMinimalParams({
        userConfig: { build: { outDirName: 'output' } },
      }),
    )
    expect(config.build?.outDir).toBe('/test/project/output')
  })

  it('should normalize define values', () => {
    const config = createViteConfig(
      createMinimalParams({
        env: { MODE: 'development' },
        userConfig: { define: { APP_NAME: 'test' } },
      }),
    )
    expect(config.define).toHaveProperty('MODE', '"development"')
    expect(config.define).toHaveProperty('APP_NAME', '"test"')
  })

  it('should properly serialize object define values', () => {
    const config = createViteConfig(
      createMinimalParams({
        userConfig: { define: { PKG: { name: 'app', version: '1.0' } } },
      }),
    )
    expect(config.define).toHaveProperty(
      'PKG',
      '{"name":"app","version":"1.0"}',
    )
  })

  it('should set sourcemap from userConfig', () => {
    const config = createViteConfig(
      createMinimalParams({
        command: 'build',
        userConfig: { build: { sourceMap: true } },
      }),
    )
    expect(config.build?.sourcemap).toBe(true)
  })

  it('should default sourcemap to false', () => {
    const config = createViteConfig(createMinimalParams({ command: 'build' }))
    expect(config.build?.sourcemap).toBe(false)
  })

  it('should include ikaros build plugin for build command', () => {
    const config = createViteConfig(createMinimalParams({ command: 'build' }))
    const pluginNames = (config.plugins as Array<{ name?: string }>)
      .filter((p) => p && typeof p === 'object' && 'name' in p)
      .map((p) => p.name)
    expect(pluginNames).toContain('ikaros:vite-build')
  })

  it('should not include ikaros build plugin for server command', () => {
    const config = createViteConfig(createMinimalParams({ command: 'server' }))
    const pluginNames = (config.plugins as Array<{ name?: string }>)
      .filter((p) => p && typeof p === 'object' && 'name' in p)
      .map((p) => p.name)
    expect(pluginNames).not.toContain('ikaros:vite-build')
  })

  it('should accept optional new fields without error', () => {
    const config = createViteConfig(
      createMinimalParams({
        browserslist: 'defaults',
        isVue: true,
        isReact: false,
        contextPkg: { name: 'test-app', version: '1.0.0' },
      }),
    )
    expect(config).toBeDefined()
  })

  it('should configure proxy for dev server', () => {
    const config = createViteConfig(
      createMinimalParams({
        command: 'server',
        userConfig: {
          server: {
            proxy: { '/api': 'http://localhost:8080' },
          },
        },
      }),
    )
    expect(config.server?.proxy).toEqual({ '/api': 'http://localhost:8080' })
  })

  it('should configure https for dev server', () => {
    const config = createViteConfig(
      createMinimalParams({
        command: 'server',
        userConfig: {
          server: { https: true },
        },
      }),
    )
    expect(config.server?.https).toEqual({})
  })
})
