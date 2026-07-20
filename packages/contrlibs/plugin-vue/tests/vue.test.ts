import { describe, expect, it, vi } from 'vitest'

import { vue } from '../src'

describe('vue', () => {
  it('为 Rspack 添加 Vize Vue SFC loader 与对应插件', async () => {
    const modifyNormalizedConfig = vi.fn()
    const modifyRspackPlugins = vi.fn()
    const modifyRspackConfig = vi.fn()
    const plugin = vue()

    expect(plugin.name).toBe('plugin-vue')

    await plugin.setup({
      modifyNormalizedConfig,
      modifyRspackConfig,
      modifyRspackPlugins,
    } as never)

    const config = {
      bundler: 'rspack',
      rspack: {
        loaders: [],
      },
    }
    const normalized = modifyNormalizedConfig.mock.calls[0][0](config)

    expect(normalized.rspack.loaders).toEqual([
      expect.objectContaining({
        loader: expect.stringContaining('@vizejs/rspack-plugin'),
      }),
    ])

    const plugins = { append: vi.fn() }
    await modifyRspackPlugins.mock.calls[0][0](plugins, { config: normalized })
    expect(plugins.append).toHaveBeenCalledWith(
      'vue:vize',
      expect.anything(),
    )

    const rspackConfig = modifyRspackConfig.mock.calls[0][0]({
      resolveLoader: {
        alias: { 'custom-loader': '/custom-loader.mjs' },
      },
    })
    expect(rspackConfig.resolveLoader.alias).toMatchObject({
      '@vizejs/rspack-plugin/loader': expect.stringContaining(
        '@vizejs/rspack-plugin',
      ),
      '@vizejs/rspack-plugin/jsx-loader': expect.stringContaining(
        '@vizejs/rspack-plugin',
      ),
      '@vizejs/rspack-plugin/style-loader': expect.stringContaining(
        '@vizejs/rspack-plugin',
      ),
      '@vizejs/rspack-plugin/scope-loader': expect.stringContaining(
        '@vizejs/rspack-plugin',
      ),
      'custom-loader': '/custom-loader.mjs',
    })
  })

  it('不会重复添加项目已有的 Vize loader rule', async () => {
    const modifyNormalizedConfig = vi.fn()
    const plugin = vue()

    await plugin.setup({
      modifyNormalizedConfig,
      modifyRspackConfig: vi.fn(),
      modifyRspackPlugins: vi.fn(),
    } as never)

    const loaders = [
      { test: /\.vue$/, loader: '@vizejs/rspack-plugin/loader' },
    ]
    const normalized = modifyNormalizedConfig.mock.calls[0][0]({
      bundler: 'rspack',
      rspack: { loaders },
    })

    expect(normalized.rspack.loaders).toBe(loaders)
  })
})
