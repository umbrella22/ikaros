import { describe, expect, it, vi } from 'vitest'

vi.mock('@ikaros-cli/ikaros', () => {
  class CreateLoader {
    useDefaultScriptLoader() {
      return this
    }

    add() {
      return this
    }

    end() {
      return []
    }
  }

  class CreatePlugins {
    useDefaultEnvPlugin() {
      return this
    }

    add() {
      return this
    }

    end() {
      return []
    }
  }

  return {
    Command: {
      BUILD: 'build',
      SERVER: 'server',
    },
    CreateLoader,
    CreatePlugins,
    extensions: ['.js', '.ts'],
    resolveCLI: (...paths: string[]) => `/cli/${paths.join('/')}`,
  }
})

import { createElectronMainRspackConfig } from '../src/config/main-config'
import { createElectronPreloadRspackConfigs } from '../src/config/preload-config'

const baseParams = {
  command: 'build',
  env: {},
  context: '/project',
  resolveContext: (...paths: string[]) => `/project/${paths.join('/')}`,
}

describe('electron output directories', () => {
  it('默认情况下 main 与 preload 应输出到独立目录', async () => {
    const mainConfig = await createElectronMainRspackConfig(baseParams)
    const preloadConfigs = await createElectronPreloadRspackConfigs(baseParams)

    expect(mainConfig.output).toMatchObject({
      path: '/project/dist/electron/main',
      clean: true,
    })
    expect(preloadConfigs[0]?.config.output).toMatchObject({
      path: '/project/dist/electron/preload',
      clean: true,
    })
  })

  it('配置 build.outDir 时 main 与 preload 应分别落到子目录', async () => {
    const userConfig = {
      electron: {
        build: {
          outDir: 'release',
        },
      },
    }

    const mainConfig = await createElectronMainRspackConfig({
      ...baseParams,
      userConfig,
    })
    const preloadConfigs = await createElectronPreloadRspackConfigs({
      ...baseParams,
      userConfig,
    })

    expect(mainConfig.output).toMatchObject({
      path: '/project/release/main',
    })
    expect(preloadConfigs[0]?.config.output).toMatchObject({
      path: '/project/release/preload',
    })
  })
})
