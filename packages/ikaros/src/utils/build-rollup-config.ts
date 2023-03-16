import { nodeResolve } from '@rollup/plugin-node-resolve'
import { builtinModules } from 'node:module'
import commonjs from '@rollup/plugin-commonjs'
import replace from '@rollup/plugin-replace'
import alias from '@rollup/plugin-alias'
import json from '@rollup/plugin-json'
import esbuild from 'rollup-plugin-esbuild'
import obfuscator from 'rollup-plugin-obfuscator'
import type { InputPluginOption, RollupOptions } from 'rollup'
import type { MainConfig } from '../config'

export const buildRollupConfig = (userConfig: MainConfig): RollupOptions => {
  const { entryDir, outputDir, obfuscate, external, plugins, rollupAlias } =
    userConfig

  const config: RollupOptions = {
    input: entryDir,
    output: {
      file: outputDir,
      format: 'cjs',
      exports: 'auto',
      sourcemap: false,
    },
    external: [...builtinModules],
    plugins: [
      alias({
        entries: rollupAlias,
      }),
      nodeResolve({
        extensions: ['.js', '.ts', '.tsx'],
      }),
      commonjs(),
      replace({
        preventAssignment: true,
        'process.env.NODE_ENV': JSON.stringify('production'),
      }),
      json(),
      esbuild({
        target: 'es2019',
        minify: true,
        sourceMap: false,
      }),
    ],
  }
  if (external && config.external) {
    ;(config.external as string[]).push(...external)
  }
  if (config.plugins) {
    if (plugins) {
      ;(config.plugins as InputPluginOption[]).concat(plugins)
    }
    if (obfuscate) {
      ;(config.plugins as InputPluginOption[]).push(obfuscator({}))
    }
  }

  return config
}
