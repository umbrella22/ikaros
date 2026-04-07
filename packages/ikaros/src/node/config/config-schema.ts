// config/config-schema.ts — Zod 校验逻辑（从 common-tools.ts 拆出）

import type { DefinePluginOptions, Loader, Plugin } from '@rspack/core'
import { z } from 'zod'

import type {
  Pages,
  RspackExperiments,
} from '../bundler/rspack/loader-plugin-helper'
import type { CdnPluginOptions } from '../plugins/cdn-plugin'
import { DEFAULT_BASE_PATH, DEFAULT_OUT_DIR } from '../shared/constants'
import type { LibraryFormat, ModuleFederationOptions } from './user-config'

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
        z.custom<(format: LibraryFormat, entryName: string) => string>(
          (value) => typeof value === 'function',
        ),
      ])
      .optional(),
    cssFileName: z.string().optional(),
    externals: z.array(z.union([z.string(), z.instanceof(RegExp)])).optional(),
    globals: z.record(z.string(), z.string()).optional(),
  })
  .superRefine((value, ctx) => {
    const formats = value.formats ?? []
    const needsName = formats.some(
      (format) => format === 'umd' || format === 'iife',
    )

    if (needsName && !value.name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['name'],
        message: "library.name 在使用 'umd' 或 'iife' 格式时必须指定",
      })
    }
  })
  .optional()

const rspackNamespaceSchema = z
  .object({
    plugins: z
      .union([z.custom<Plugin>(), z.array(z.custom<Plugin>())])
      .optional(),
    loaders: z.array(z.custom<Loader>()).optional(),
    experiments: z.custom<RspackExperiments>().optional(),
    cdnOptions: z.custom<CdnPluginOptions>().optional(),
    moduleFederation: z
      .union([
        z.custom<ModuleFederationOptions>(),
        z.array(z.custom<ModuleFederationOptions>()),
      ])
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
  })
  .strict()

const viteNamespaceSchema = z
  .object({
    plugins: z.unknown().optional(),
  })
  .strict()

const buildSchema = z
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
  .optional()

const resolveSchema = z
  .object({
    alias: z.record(z.string(), z.string()).optional(),
    extensions: z.array(z.string()).optional(),
  })
  .optional()

const serverSchema = z
  .object({
    port: z.number().int().min(1024).max(65535).optional(),
    proxy: z.unknown().optional(),
    https: z.union([z.boolean(), z.record(z.string(), z.unknown())]).optional(),
  })
  .optional()

const ikarosPluginSchema = z
  .object({
    name: z.string().min(1),
    setup: z.custom((value) => typeof value === 'function'),
  })
  .strict()

export const configSchema = z
  .object({
    bundler: z.enum(['rspack', 'vite']).optional().default('rspack'),
    plugins: z.array(ikarosPluginSchema).optional(),
    target: z.enum(['pc', 'mobile']).optional().default('pc'),
    quiet: z.boolean().optional().default(false),
    pages: z.custom<Pages>().optional(),
    enablePages: z.union([z.array(z.string()), z.literal(false)]).optional(),
    define: z.custom<DefinePluginOptions>().optional(),
    rspack: rspackNamespaceSchema.optional(),
    vite: viteNamespaceSchema.optional(),
    server: serverSchema,
    build: buildSchema,
    resolve: resolveSchema,
    library: librarySchema,
    electron: z.unknown().optional(),
  })
  .strict()
