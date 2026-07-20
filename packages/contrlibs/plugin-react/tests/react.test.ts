import { describe, expect, it, vi } from 'vitest'

import { react } from '../src'

describe('react', () => {
  it('为 Rspack 开发配置添加 JSX transform 与 Fast Refresh', async () => {
    const modifyNormalizedConfig = vi.fn()
    const modifyRspackPlugins = vi.fn()
    const plugin = react()

    expect(plugin.name).toBe('plugin-react')

    await plugin.setup({
      command: 'server',
      modifyNormalizedConfig,
      modifyRspackPlugins,
    } as never)

    const config = {
      bundler: 'rspack',
      rspack: {
        loaders: [],
      },
    }
    const normalized = modifyNormalizedConfig.mock.calls[0][0](config)

    expect(normalized.rspack.swc).toMatchObject({
      jsc: {
        transform: {
          react: {
            runtime: 'automatic',
            development: true,
            refresh: true,
          },
        },
      },
    })

    const plugins = { append: vi.fn() }
    await modifyRspackPlugins.mock.calls[0][0](plugins, { config: normalized })
    expect(plugins.append).toHaveBeenCalledWith(
      'react-refresh',
      expect.anything(),
    )
  })

  it('保留用户已有的 React SWC 配置', async () => {
    const modifyNormalizedConfig = vi.fn()
    const plugin = react()

    await plugin.setup({
      command: 'build',
      modifyNormalizedConfig,
      modifyRspackPlugins: vi.fn(),
    } as never)

    const normalized = modifyNormalizedConfig.mock.calls[0][0]({
      bundler: 'rspack',
      rspack: {
        loaders: [],
        swc: {
          jsc: {
            transform: {
              react: {
                runtime: 'classic',
              },
            },
          },
        },
      },
    })

    expect(normalized.rspack.swc.jsc.transform.react).toMatchObject({
      runtime: 'classic',
      development: false,
      refresh: false,
    })
  })
})
