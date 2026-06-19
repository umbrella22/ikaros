import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocked = vi.hoisted(() => ({
  checkDependency: vi.fn(() => false),
}))

vi.mock('../../src/node/shared/common', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../src/node/shared/common')>()
  return {
    ...actual,
    checkDependency: mocked.checkDependency,
  }
})

import {
  explainNormalizedConfig,
  normalizeConfig,
} from '../../src/node/config/normalize-config'
import { Command } from '../../src/node/compile/compile-context'
import { BROWSERSLIST, DEFAULT_PORT } from '../../src/node/shared/constants'

const resolveTestContext = (...paths: string[]) =>
  ['/test/project', ...paths].join('/')

describe('normalizeConfig', () => {
  beforeEach(() => {
    mocked.checkDependency.mockReset()
    mocked.checkDependency.mockReturnValue(false)
  })

  it('应填充默认值并派生基础字段', async () => {
    const config = await normalizeConfig({
      command: Command.BUILD,
      context: '/test/project',
      resolveContext: resolveTestContext,
    })

    expect(config.bundler).toBe('rspack')
    expect(config.base).toBe('/')
    expect(config.port).toBe(DEFAULT_PORT)
    expect(config.server.port).toBe(DEFAULT_PORT)
    expect(config.pages).toEqual({
      index: {
        html: '/test/project/index.html',
        entry: '/test/project/src/index',
      },
    })
    expect(config.resolve.alias).toEqual({
      '@': '/test/project/src',
    })
    expect(config.library).toBeNull()
  })

  it('server 模式未配置端口时应使用调用方解析的端口', async () => {
    const config = await normalizeConfig({
      command: Command.SERVER,
      context: '/test/project',
      resolveContext: resolveTestContext,
      resolvedPort: 4321,
    })

    expect(config.port).toBe(4321)
    expect(config.server.port).toBe(4321)
  })

  it('应合并用户配置并派生框架检测结果', async () => {
    mocked.checkDependency.mockImplementation((pkg?: string) => pkg === 'react')

    const plugin = { name: 'rspack-plugin' } as never
    const config = await normalizeConfig({
      command: Command.BUILD,
      context: '/test/project',
      resolveContext: resolveTestContext,
      userConfig: {
        app: {
          target: 'mobile',
        },
        source: {
          define: { __DEV__: 'true' },
          alias: { '~': '/custom/path' },
          extensions: ['.ts', '.tsx'],
        },
        dev: {
          pages: ['admin'],
          port: 9000,
          https: true,
        },
        bundle: {
          rspack: {
            plugins: [plugin],
            moduleFederation: {
              name: 'app',
            },
          },
        },
      },
    })

    expect(config.target).toBe('mobile')
    expect(config.port).toBe(9000)
    expect(config.server.https).toBe(true)
    expect(config.define).toEqual({ __DEV__: 'true' })
    expect(config.enablePages).toEqual(['admin'])
    expect(config.resolve.alias).toEqual({
      '@': '/test/project/src',
      '~': '/custom/path',
    })
    expect(config.resolve.extensions).toEqual(['.ts', '.tsx'])
    expect(config.rspack.plugins).toEqual([plugin])
    expect(config.rspack.moduleFederation).toEqual([{ name: 'app' }])
    expect(config.isReact).toBe(true)
    expect(config.isVue).toBe(false)
    expect(config.browserslist).toBe(BROWSERSLIST.mobile.join(','))
  })

  it('开发模式下应拒绝外部 output.base', async () => {
    await expect(
      normalizeConfig({
        command: Command.SERVER,
        context: '/test/project',
        resolveContext: resolveTestContext,
        userConfig: {
          output: {
            base: 'https://cdn.example.com/assets/',
          },
        },
      }),
    ).rejects.toThrow('output.base')
  })

  it('开发模式下应大小写无关地拒绝外部 output.base', async () => {
    await expect(
      normalizeConfig({
        command: Command.SERVER,
        context: '/test/project',
        resolveContext: resolveTestContext,
        userConfig: {
          output: {
            base: 'HTTPS://cdn.example.com/assets/',
          },
        },
      }),
    ).rejects.toThrow('output.base')
  })

  it('electron 模式应生成 renderer 默认页面', async () => {
    const config = await normalizeConfig({
      command: Command.BUILD,
      context: '/test/project',
      resolveContext: resolveTestContext,
      isElectron: true,
    })

    expect(config.isElectron).toBe(true)
    expect(config.pages).toEqual({
      index: {
        html: '/test/project/src/renderer/index.html',
        entry: '/test/project/src/renderer/index',
      },
    })
  })

  it('应输出可解释的规范化诊断', async () => {
    const baseConfig = await normalizeConfig({
      command: Command.BUILD,
      context: '/test/project',
      resolveContext: resolveTestContext,
      userConfig: {
        app: {
          target: 'mobile',
        },
        output: {
          base: '/app/',
        },
        dev: {
          port: 8080,
        },
      },
    })

    const diagnostics = explainNormalizedConfig({
      command: Command.BUILD,
      userConfig: {
        app: {
          target: 'mobile',
        },
        output: {
          base: '/app/',
        },
        dev: {
          port: 8080,
        },
      },
      normalizedConfig: {
        ...baseConfig,
        base: '/plugin-base/',
      },
      baseNormalizedConfig: baseConfig,
    })

    expect(diagnostics.target).toMatchObject({
      value: 'mobile',
      source: 'user.app.target',
    })
    expect(diagnostics.base).toMatchObject({
      value: '/plugin-base/',
      source: 'plugin.modifyNormalizedConfig',
      overriddenFrom: '/app/',
    })
    expect(diagnostics.port).toMatchObject({
      value: 8080,
      source: 'user.dev.port',
      requestedPort: 8080,
      autoDetected: false,
    })
    expect(diagnostics.framework.selected).toMatchObject({
      value: 'none',
      source: 'framework.none',
    })
  })

  it('explain 应基于原始显式配置判断来源', async () => {
    const baseConfig = await normalizeConfig({
      command: Command.BUILD,
      context: '/test/project',
      resolveContext: resolveTestContext,
    })

    const diagnostics = explainNormalizedConfig({
      command: Command.BUILD,
      userConfig: {
        app: {
          target: 'pc',
        },
        output: {
          base: '/',
        },
        dev: {
          port: DEFAULT_PORT,
        },
      },
      sourceUserConfig: {},
      normalizedConfig: baseConfig,
      baseNormalizedConfig: baseConfig,
    })

    expect(diagnostics.target.source).toBe('default.app.target')
    expect(diagnostics.base.source).toBe('default.output.base')
    expect(diagnostics.port.source).toBe('default.dev.port')
  })

  it('explain 应保留显式用户配置来源', async () => {
    const baseConfig = await normalizeConfig({
      command: Command.BUILD,
      context: '/test/project',
      resolveContext: resolveTestContext,
      userConfig: {
        output: {
          base: '/app/',
        },
      },
    })

    const diagnostics = explainNormalizedConfig({
      command: Command.BUILD,
      userConfig: baseConfig as never,
      sourceUserConfig: {
        output: {
          base: '/app/',
        },
      },
      normalizedConfig: baseConfig,
      baseNormalizedConfig: baseConfig,
    })

    expect(diagnostics.base.source).toBe('user.output.base')
  })
})
