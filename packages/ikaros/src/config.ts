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
  target: 'web' | 'client'
  entryDir: string
  outputDir: string
}

export interface IkarosUserConfig extends BaseConfig {
  main: MainConfig
  renderer: RendererConfig
  preload?: PreloadConfig
}
