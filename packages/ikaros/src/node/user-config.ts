import type { OptionType } from 'postcss-px-to-viewport-8-plugin/lib/types'
import type { RollupOptions } from 'rollup'
import type { Options } from 'rollup-plugin-esbuild'
import type { RollupPluginObfuscatorOptions } from 'rollup-plugin-obfuscator'
import type { UserConfig } from 'vite'

type Preload =
  | {
      name: string
      entry: string
    }
  | string
export interface MainConfig {
  /** rollup配置 */
  rollupOption?: RollupOptions
  /** 是否混淆 */
  obfuscate?: boolean
  /** 是否生成字节码 */
  bytecode?: boolean
  /** 混淆配置 */
  obfuscateOptions?: RollupPluginObfuscatorOptions
  /** esbuild配置 */
  esbuildOption?: Options
}
export interface RendererConfig {
  /** vite配置 */
  viteOption?: UserConfig
  /**是否启用px转换 */
  pxToVW?: boolean
  pxToVWConfig?: OptionType
  /**
   * 是否启用devTools
   * mobile时启动vconsole
   * 仅在serve时生效
   * @default false
   */
  devTools?: boolean
}
export interface PreloadConfig extends MainConfig {
  /** 预加载脚本入口 */
  entry: Preload | Preload[]
}

export interface BaseConfig {
  /** 模式：网页或者是客户端*/
  mode: 'web' | 'client'
  /** 标志：仅web模式生效 */
  target: 'pc' | 'mobile'
  /** 入口目录 */
  entryDir: string
  /** 输出目录 */
  outputDir: string
}

export interface IkarosUserConfig extends BaseConfig {
  /** 主进程配置 */
  main?: MainConfig
  /** 渲染进程配置 */
  renderer?: RendererConfig
  /** 预加载配置 */
  preload?: PreloadConfig
}
export type ConfigEnv = {
  mode: BaseConfig['mode']
  target: BaseConfig['target']
  command: 'serve' | 'build'
}
export type UserConfigFn = (env: ConfigEnv) => UserConfig | Promise<UserConfig>

/** 辅助工具函数 */
export const defineConfig = (config: IkarosUserConfig) => config
