import { join } from 'node:path'
import type { UserConfig } from 'vite'
import type { IkarosUserConfig } from '../user-config'
import { rootDir } from '.'
import { externalBuiltins } from '../plugins/vite-plugin/externalBuiltins'

const getUserConfig = (config: IkarosUserConfig) => {
  const {
    renderer: { viteOption },
    entryDir,
    outputDir,
    target,
  } = config
  const root = join(rootDir, entryDir)
  const outDir = join(rootDir, outputDir)
  const defineConfig: UserConfig = {
    base: './',
    root,
    build: {
      reportCompressedSize: false,
      outDir,
    },
  }
  const viteConfig = Object.assign({}, viteOption, defineConfig)
  return {
    target,
    entryDir,
    outputDir,
    viteOption: viteConfig,
  }
}

export const buildViteConfig = (userConfig: IkarosUserConfig): UserConfig => {
  const { viteOption, target } = getUserConfig(userConfig)

  const plugins = viteOption.plugins || []

  if (target !== 'web') {
    plugins.push(externalBuiltins())
  }
  viteOption.plugins = plugins

  return viteOption
}
