import { isObject } from 'radashi'
import type { Configuration } from '@rspack/dev-server'
import type { Loader, Plugin } from '@rspack/core'
import fsp from 'fs/promises'
import { z } from 'zod/v4'
import { join } from 'path'

import type { Pages, RspackExperiments } from './loaders-plugins-helper'
import { ModuleFederationOptions } from '../user-config'
import { CdnPluginOptions } from '../plugins/cdn-plugin'

export const mergeUserConfig = <T extends Record<string, any>>(
  target: T,
  source: T,
): T => {
  for (const key in source) {
    target[key] =
      isObject(source[key]) && key in target
        ? mergeUserConfig(target[key], source[key])
        : source[key]
  }
  return target
}

/**
 * 检查指定依赖是否存在（Promise化）
 * @param {string} packageName 要检查的包名
 * @returns {Promise<boolean>} 是否存在
 */
export async function checkDependency(packageName: string): Promise<boolean> {
  try {
    const modulePath = join(process.cwd(), 'node_modules', packageName)
    await fsp.access(modulePath, fsp.constants.F_OK)
    return true
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false
    }
    throw error // 抛出非"文件不存在"的其他错误
  }
}

export const configSchema = z.object({
  target: z.enum(['pc', 'mobile']).optional().default('pc'),
  pages: z.custom<Pages>().optional(),
  enablePages: z.union([z.array(z.string())]).optional(),
  moduleFederation: z
    .union([
      z.custom<ModuleFederationOptions>(),
      z.array(z.custom<ModuleFederationOptions>()),
    ])
    .optional(),
  plugins: z
    .union([z.custom<Plugin>(), z.array(z.custom<Plugin>())])
    .optional(),
  loaders: z.array(z.custom<Loader>()).optional(),
  experiments: z.custom<RspackExperiments>().optional(),
  cdnOptions: z.custom<CdnPluginOptions>().optional(),
  server: z
    .object({
      port: z.number().int().min(1024).max(65535).optional(),
      proxy: z.custom<Configuration['proxy']>().optional(),
      https: z
        .union([z.boolean(), z.record(z.string(), z.any())])
        .optional()
        .default(false),
    })
    .optional(),
  css: z
    .object({
      lightningcssOptions: z.record(z.string(), z.any()).optional(),
      sourceMap: z.boolean().optional(),
      lessOptions: z.record(z.string(), z.any()).optional(),
      sassOptions: z.record(z.string(), z.any()).optional(),
      stylusOptions: z.record(z.string(), z.any()).optional(),
    })
    .optional(),
  build: z
    .object({
      base: z.string().optional().default('/'),
      assetsDir: z.string().optional(),
      gzip: z.boolean().optional().default(false),
      sourceMap: z.boolean().optional().default(false),
      outDirName: z.string().optional().default('dist'),
      outReport: z.boolean().optional().default(false),
      cache: z.boolean().optional().default(false),
      dependencyCycleCheck: z.boolean().optional().default(false),
    })
    .optional(),
  resolve: z
    .object({
      alias: z.record(z.string(), z.string()).optional(),
      extensions: z.array(z.string()).optional(),
    })
    .optional(),
})
