import { join } from 'node:path'
import type { UserConfig } from 'vite'
import type { IkarosUserConfig } from '../user-config'
import { rootDir } from './tools'
import { externalBuiltins } from '../plugins/vite-plugin/external-builtins'
import pptv from 'postcss-px-to-viewport-8-plugin'
import type { AcceptedPlugin } from 'postcss'
import {} from '../plugins/vite-plugin/fix-name-lose'
import { vwDefaultConfig } from './const'
import { viteHtmlInjectPlugin } from '../plugins/vite-plugin/vite-html-plugin'
import { viteMobileDevtoolsPlugin } from '../plugins/vite-plugin/mobile-devtools'

const getUserConfig = (config: IkarosUserConfig) => {
  const {
    renderer,
    entryDir = 'src',
    outputDir = 'dist',
    target,
    platform,
  } = config
  const { viteOption, pxToVW, pxToVWConfig, devTools } = renderer ?? {}
  const root =
    platform === 'web' ? rootDir : join(rootDir, entryDir, 'renderer')
  const outDir =
    platform === 'web' ? outputDir : join(rootDir, outputDir, 'renderer')
  const base =
    platform === 'web'
      ? `${viteOption?.define ? (viteOption.define['import.meta.env.BASE'] ?? './') : './'}`
      : './'
  const defineConfig: UserConfig = {
    base,
    root,
    build: {
      reportCompressedSize: false,
      outDir,
    },
  }
  const viteConfig = Object.assign({}, viteOption, defineConfig)
  return {
    platform,
    target,
    entryDir,
    outputDir,
    viteOption: viteConfig,
    pxToVW,
    pxToVWConfig,
    devTools,
  }
}

export const buildViteConfig = (userConfig: IkarosUserConfig): UserConfig => {
  const {
    viteOption,
    platform,
    target,
    pxToVW = true,
    pxToVWConfig,
    devTools,
  } = getUserConfig(userConfig)

  const plugins = viteOption.plugins ?? []
  const css = viteOption.css ?? {}

  if (platform === 'web') {
    if (target === 'mobile') {
      if (pxToVW) {
        plugins.push(viteHtmlInjectPlugin())
        const defaultConfig = Object.assign({}, vwDefaultConfig, pxToVWConfig)
        const load_pptv: AcceptedPlugin = pptv(defaultConfig)
        css.postcss = {
          plugins: [load_pptv],
        }
      }
      if (devTools) {
        plugins.push(viteMobileDevtoolsPlugin({ devTools }))
      }
    }
  } else {
    plugins.push(externalBuiltins())
  }

  viteOption.css = css
  viteOption.plugins = plugins

  return viteOption
}
