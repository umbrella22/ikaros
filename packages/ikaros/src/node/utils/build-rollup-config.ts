import { nodeResolve } from '@rollup/plugin-node-resolve'
import { builtinModules } from 'node:module'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import esbuild, { type Options } from 'rollup-plugin-esbuild'
import obfuscator from 'rollup-plugin-obfuscator'
import type { RollupOptions } from 'rollup'
import type { IkarosUserConfig } from '../user-config'
import { rootDir } from './tools'
import { join } from 'node:path'

interface RollupExOptions {
  inputFile: string
  outputFile: string
}

/**
 * Build rollup config
 */
const getRollupConfig = (
  config: IkarosUserConfig,
  options?: RollupExOptions,
) => {
  const { main, entryDir, outputDir } = config
  const { rollupOption, obfuscate, obfuscateOptions, esbuildOption } =
    main ?? {}
  if (!options) {
    options = {
      inputFile: 'index.js',
      outputFile: 'main.js',
    }
  }
  const { inputFile, outputFile } = options
  const input = join(rootDir, entryDir, 'main', inputFile)
  const output = join(rootDir, outputDir, 'mian', outputFile)
  const defineConfig: RollupOptions = {
    input,
    output: {
      file: output,
      format: 'cjs',
      exports: 'auto',
      sourcemap: false,
    },
  }
  const rollupConfig = Object.assign({}, rollupOption, defineConfig)

  return {
    obfuscate,
    entryDir,
    outputDir,
    rollupConfig,
    obfuscateOptions,
    esbuildOption,
  }
}

export const buildRollupConfig = (
  userConfig: IkarosUserConfig,
  options?: RollupExOptions,
): RollupOptions => {
  const { rollupConfig, obfuscate, obfuscateOptions, esbuildOption } =
    getRollupConfig(userConfig, options)
  const { external, plugins } = rollupConfig
  const exExternal = external ?? []
  const exPlugins = plugins ?? []

  const defaultEsbuildOption: Options = {
    include: /\.[jt]s?$/,
    exclude: /node_modules/,
    target: 'esnext',
    // Add extra loaders
    loaders: {
      '.json': 'json',
      '.js': 'jsx',
    },
  }

  if (Array.isArray(exExternal)) {
    exExternal.push(...builtinModules)
  }

  if (Array.isArray(exPlugins)) {
    exPlugins.push(
      commonjs(),
      json(),
      nodeResolve(),
      esbuild(esbuildOption ?? defaultEsbuildOption),
    )
    if (obfuscate) {
      exPlugins.push(
        obfuscator(
          obfuscateOptions ?? {
            global: true,
          },
        ),
      )
    }
  }

  rollupConfig.plugins = exPlugins
  rollupConfig.external = exExternal

  return rollupConfig
}
