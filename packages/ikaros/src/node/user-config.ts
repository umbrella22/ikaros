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
  rollupOption?: RollupOptions
  obfuscate?: boolean
  bytecode?: boolean
  obfuscateOptions?: RollupPluginObfuscatorOptions
  esbuildOption?: Options
}
export interface RendererConfig {
  viteOption?: UserConfig
}
export interface PreloadConfig extends MainConfig {
  entry: Preload | Preload[]
}

export interface BaseConfig {
  /** 模式：网页或者是客户端*/
  mode: 'web' | 'client'
  /** 标志：仅web模式生效 */
  target: 'web' | 'mobile'
  /** 入口目录 */
  entryDir: string
  /** 输出目录 */
  outputDir: string
}

export interface IkarosUserConfig extends BaseConfig {
  main: MainConfig
  renderer: RendererConfig
  preload?: PreloadConfig
}

/** 辅助工具函数 */
export const defineConfig = (config: IkarosUserConfig) => config