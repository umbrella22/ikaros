import { describe, it, expect } from 'vitest'
import { RspackAdapter } from '../../src/node/bundler/rspack'
import type { CreateConfigParams } from '../../src/node/bundler/types'

describe('RspackAdapter', () => {
  it('name 应为 "rspack"', () => {
    const adapter = new RspackAdapter()
    expect(adapter.name).toBe('rspack')
  })

  it('createConfig() 应返回有效的 rspack Configuration', () => {
    const adapter = new RspackAdapter()

    const params: CreateConfigParams = {
      command: 'server',
      mode: undefined,
      env: {},
      context: process.cwd(),
      contextPkg: { name: 'test-app', version: '0.0.1' },
      userConfig: undefined,
      pages: {
        index: {
          html: 'index.html',
          entry: 'src/index.ts',
        },
      },
      base: '/',
      port: 8080,
      browserslist: 'defaults',
      isElectron: false,
      isVue: false,
      isReact: false,
      resolveContext: (...paths: string[]) =>
        [process.cwd(), ...paths].join('/'),
    }

    // createConfig 不应抛异常
    const config = adapter.createConfig(params)
    expect(config).toBeDefined()
    expect(config).toHaveProperty('mode', 'development')
    expect(config).toHaveProperty('entry')
    expect(config).toHaveProperty('plugins')
    expect(config).toHaveProperty('module')
  })

  it('createConfig() build 模式应返回 production', () => {
    const adapter = new RspackAdapter()

    const params: CreateConfigParams = {
      command: 'build',
      mode: undefined,
      env: {},
      context: process.cwd(),
      contextPkg: { name: 'test-app', version: '0.0.1' },
      userConfig: undefined,
      pages: {
        index: {
          html: 'index.html',
          entry: 'src/index.ts',
        },
      },
      base: '/',
      port: 8080,
      browserslist: 'defaults',
      isElectron: false,
      isVue: false,
      isReact: false,
      resolveContext: (...paths: string[]) =>
        [process.cwd(), ...paths].join('/'),
    }

    const config = adapter.createConfig(params)
    expect(config).toHaveProperty('mode', 'production')
  })
})
