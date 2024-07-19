import { join } from 'node:path'
import type { UserConfig } from 'vite'
import type { IkarosUserConfig } from '../user-config'
import { rootDir } from './tools'
import { externalBuiltins } from '../plugins/vite-plugin/external-builtins'
import pptv from 'postcss-px-to-viewport-8-plugin'
import { AcceptedPlugin } from 'postcss'
import { } from '../plugins/vite-plugin/fix-name-lose'

const getUserConfig = (config: IkarosUserConfig) => {
  const { renderer, entryDir, outputDir, target, mode } = config
  const { viteOption, pxToVW, pxToVWConfig } = renderer ?? {}
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
    mode,
    target,
    entryDir,
    outputDir,
    viteOption: viteConfig,
    pxToVW,
    pxToVWConfig,
  }
}

export const buildViteConfig = (userConfig: IkarosUserConfig): UserConfig => {
  const {
    viteOption,
    mode,
    target,
    pxToVW = true,
    pxToVWConfig,
  } = getUserConfig(userConfig)

  const plugins = viteOption.plugins ?? []
  const css = viteOption.css ?? {}

  if (mode !== 'web') {
    plugins.push(externalBuiltins())
  }
  if (target === 'mobile' && mode === 'web' && pxToVW) {
    const defaultConfig = Object.assign(
      {},
      {
        unitToConvert: 'px', // 要转化的单位
        viewportWidth: 375, // UI设计稿的宽度
        unitPrecision: 6, // 转换后的精度，即小数点位数
        propList: ['*'], // 指定转换的css属性的单位，*代表全部css属性的单位都进行转换
        viewportUnit: 'vw', // 指定需要转换成的视窗单位，默认vw
        fontViewportUnit: 'vw', // 指定字体需要转换成的视窗单位，默认vw
        selectorBlackList: ['ignore-'], // 指定不转换为视窗单位的类名，
        minPixelValue: 1, // 默认值1，小于或等于1px则不进行转换
        mediaQuery: true, // 是否在媒体查询的css代码中也进行转换，默认false
        replace: true, // 是否转换后直接更换属性值
        landscape: false, // 是否处理横屏情况
      },
      pxToVWConfig,
    )
    const load_pptv: AcceptedPlugin = pptv(defaultConfig)

    css.postcss = {
      plugins: [load_pptv],
    }
  }

  viteOption.css = css
  viteOption.plugins = plugins

  return viteOption
}
