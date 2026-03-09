// config/config-schema.ts — Zod 校验逻辑（从 common-tools.ts 拆出）

import type { Configuration } from '@rspack/dev-server'
import type {
  DefinePluginOptions,
  Loader,
  ModuleFederationPluginOptions,
  Plugin,
} from '@rspack/core'
import { z } from 'zod/v4'

import type {
  Pages,
  RspackExperiments,
} from '../bundler/rspack/loader-plugin-helper'
import { CdnPluginOptions } from '../plugins/cdn-plugin'
import type { UserConfig } from './user-config'
import type { LibraryFormat } from './user-config'
import { DEFAULT_BASE_PATH, DEFAULT_OUT_DIR } from '../shared/constants'

type Bundler = 'rspack' | 'vite'

// ─── Library Schema ─────────────────────────────────────────────────────────

const libraryFormatSchema = z.enum(['es', 'cjs', 'umd', 'iife'])

const librarySchema = z
  .object({
    entry: z.union([
      z.string(),
      z.array(z.string()),
      z.record(z.string(), z.string()),
    ]),
    name: z.string().optional(),
    formats: z.array(libraryFormatSchema).optional(),
    fileName: z
      .union([
        z.string(),
        z.custom<(format: LibraryFormat, entryName: string) => string>(),
      ])
      .optional(),
    cssFileName: z.string().optional(),
    externals: z.array(z.union([z.string(), z.instanceof(RegExp)])).optional(),
    globals: z.record(z.string(), z.string()).optional(),
  })
  .superRefine((val, ctx) => {
    const formats = val.formats ?? []
    const needsName = formats.some((f) => f === 'umd' || f === 'iife')
    if (needsName && !val.name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['name'],
        message: "library.name 在使用 'umd' 或 'iife' 格式时必须指定",
      })
    }
  })
  .optional()

const commonSchema = {
  target: z.enum(['pc', 'mobile']).optional().default('pc'),
  quiet: z.boolean().optional().default(false),
  pages: z.custom<Pages>().optional(),
  enablePages: z.union([z.array(z.string()), z.literal(false)]).optional(),
  define: z.custom<DefinePluginOptions>().optional(),
  library: librarySchema,
  build: z
    .object({
      base: z.string().optional().default(DEFAULT_BASE_PATH),
      assetsDir: z.string().optional(),
      sourceMap: z.boolean().optional().default(false),
      outDirName: z.string().optional().default(DEFAULT_OUT_DIR),
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
      base: z.string().optional().default(DEFAULT_BASE_PATH),
      assetsDir: z.string().optional(),
      gzip: z.boolean().optional().default(false),
      sourceMap: z.boolean().optional().default(false),
      outDirName: z.string().optional().default(DEFAULT_OUT_DIR),
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
  // vite 模式下禁止使用 rspack-only 字段，避免"看起来配置了但其实不生效"的困扰
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
          path: [key],
          message: `bundler='vite' 时不支持 ${key}，请使用 vite.plugins 或 Vite 原生配置能力`,
        })
      }
    }
  })

export const configSchema: z.ZodType<UserConfig> = z.union([
  viteConfigSchema,
  rspackConfigSchema,
]) as unknown as z.ZodType<UserConfig>
