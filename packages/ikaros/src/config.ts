import type { Alias } from '@rollup/plugin-alias'
import type { InputPluginOption } from 'rollup'
import type { UserConfig } from 'vite'

type Preload = {
  name: string
  entry: string
}
// TODO:需要将minify，obfuscate，external，rollupAlias，提取出来
export interface MainConfig {
  entryDir: string
  outputDir: string
  obfuscate?: boolean
  bytecode?: boolean
  external?: string[]
  plugins?: InputPluginOption
  rollupAlias?: readonly Alias[] | { [find: string]: string }
}
export interface RendererConfig {
  entryDir: string
  outputDir: string
  viteOption?: UserConfig
}
export interface PreloadConfig extends MainConfig {
  entry: Preload | Preload[]
}

export interface IkarosUserConfig {
  main: MainConfig
  renderer: RendererConfig
  preload?: PreloadConfig
}
