import { isObject } from 'es-toolkit/compat'
import type { Configuration } from '@rspack/dev-server'
import type {
  DefinePluginOptions,
  Loader,
  ModuleFederationPluginOptions,
  Plugin,
} from '@rspack/core'
import fsp from 'fs/promises'
import { z } from 'zod/v4'
import { join } from 'path'

import type { Pages, RspackExperiments } from './loader-plugin-helper'
import { CdnPluginOptions } from '../plugins/cdn-plugin'
import type { UserConfig } from '../user-config'

type Bundler = 'rspack' | 'vite'

export const mergeUserConfig = <T extends Record<string, unknown>>(
  target: T,
  source: T,
): T => {
  const targetRecord = target as Record<string, unknown>
  const sourceRecord = source as Record<string, unknown>

  for (const key of Object.keys(sourceRecord)) {
    const sourceValue = sourceRecord[key]
    const targetValue = targetRecord[key]

    if (isObject(sourceValue) && isObject(targetValue)) {
      targetRecord[key] = mergeUserConfig(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>,
      )
    } else {
      targetRecord[key] = sourceValue
    }
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

const commonSchema = {
  target: z.enum(['pc', 'mobile']).optional().default('pc'),
  pages: z.custom<Pages>().optional(),
  enablePages: z.union([z.array(z.string()), z.literal(false)]).optional(),
  define: z.custom<DefinePluginOptions>().optional(),
  build: z
    .object({
      base: z.string().optional().default('/'),
      assetsDir: z.string().optional(),
      sourceMap: z.boolean().optional().default(false),
      outDirName: z.string().optional().default('dist'),
    })
    .optional(),
  resolve: z
    .object({
      alias: z.record(z.string(), z.string()).optional(),
      extensions: z.array(z.string()).optional(),
    })
    .optional(),
  server: z
    .object({
      port: z.number().int().min(1024).max(65535).optional(),
    })
    .optional(),
  // electron 配置目前不做强校验，避免阻塞后续扩展
  electron: z.unknown().optional(),
}

const rspackConfigSchema = z.object({
  bundler: z
    .custom<Bundler>()
    .optional()
    .default('rspack')
    .refine((v) => v === 'rspack', {
      message: "bundler must be 'rspack' for rspack config",
    }),
  ...commonSchema,
  moduleFederation: z
    .union([
      z.custom<ModuleFederationPluginOptions>(),
      z.array(z.custom<ModuleFederationPluginOptions>()),
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
        .union([z.boolean(), z.record(z.string(), z.unknown())])
        .optional()
        .default(false),
    })
    .optional(),
  css: z
    .object({
      lightningcssOptions: z.record(z.string(), z.unknown()).optional(),
      sourceMap: z.boolean().optional(),
      lessOptions: z.record(z.string(), z.unknown()).optional(),
      sassOptions: z.record(z.string(), z.unknown()).optional(),
      stylusOptions: z.record(z.string(), z.unknown()).optional(),
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
})

const viteConfigSchema = z
  .object({
    bundler: z.literal('vite'),
    ...commonSchema,
    server: z
      .object({
        port: z.number().int().min(1024).max(65535).optional(),
        proxy: z.record(z.string(), z.unknown()).optional(),
        https: z
          .union([z.boolean(), z.record(z.string(), z.unknown())])
          .optional(),
      })
      .optional(),
    vite: z
      .object({
        plugins: z.unknown().optional(),
      })
      .strict()
      .optional(),
  })
  .passthrough()
  // vite 模式下禁止使用 rspack-only 字段，避免“看起来配置了但其实不生效”的困扰
  .superRefine((val, ctx) => {
    const forbiddenKeys = [
      'plugins',
      'loaders',
      'experiments',
      'cdnOptions',
      'moduleFederation',
      'css',
    ]

    for (const key of forbiddenKeys) {
      const record = val as unknown as Record<string, unknown>
      if (key in record && record[key] !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key as string],
          message: `bundler='vite' 时不支持 ${String(key)}，请使用 vite.plugins 或 Vite 原生配置能力`,
        })
      }
    }
  })

export const configSchema: z.ZodType<UserConfig> = z.union([
  viteConfigSchema,
  rspackConfigSchema,
]) as unknown as z.ZodType<UserConfig>
