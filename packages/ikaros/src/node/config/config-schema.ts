// config/config-schema.ts — Zod 校验逻辑（从 common-tools.ts 拆出）

import type {
  DefinePluginOptions,
  Loader,
  Plugin,
  SwcLoaderOptions,
} from '@rspack/core'
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

const legacyFieldMessages: Record<string, string> = {
  bundler: 'v3 使用 bundle.adapter 替代 bundler。',
  quiet: "v3 使用 log.level='quiet' 替代 quiet。",
  target: 'v3 使用 app.target 替代 target。',
  enablePages: 'v3 使用 dev.pages 替代 enablePages。',
  define: 'v3 使用 source.define 替代 define。',
  rspack: 'v3 使用 bundle.rspack 替代 rspack。',
  vite: 'v3 使用 bundle.vite 替代 vite。',
  server: 'v3 使用 dev 替代 server。',
  build: 'v3 使用 output 替代 build。',
  resolve: 'v3 使用 source.alias/source.extensions 替代 resolve。',
}

const rspackNamespaceSchema = z
  .object({
    plugins: z
      .union([z.custom<Plugin>(), z.array(z.custom<Plugin>())])
      .optional(),
    swc: z.custom<SwcLoaderOptions>().optional(),
    loaders: z.array(z.custom<Loader>()).optional(),
    experiments: z.custom<RspackExperiments>().optional(),
    cdn: z.custom<CdnPluginOptions>().optional(),
    moduleFederation: z
      .union([
        z.custom<ModuleFederationOptions>(),
        z.array(z.custom<ModuleFederationOptions>()),
      ])
      .optional(),
    css: z
      .object({
        lightningcss: z.record(z.string(), z.unknown()).optional(),
        sourceMap: z.boolean().optional(),
        less: z.record(z.string(), z.unknown()).optional(),
        sass: z.record(z.string(), z.unknown()).optional(),
        stylus: z.record(z.string(), z.unknown()).optional(),
      })
      .optional(),
  })
  .strict()

const viteNamespaceSchema = z
  .object({
    plugins: z.unknown().optional(),
  })
  .strict()

const outputSchema = z
  .object({
    base: z.string().optional().default(DEFAULT_BASE_PATH),
    assetsDir: z.string().optional(),
    gzip: z.boolean().optional().default(false),
    sourceMap: z.boolean().optional().default(false),
    dir: z.string().optional().default(DEFAULT_OUT_DIR),
    report: z.boolean().optional().default(false),
    cache: z.boolean().optional().default(false),
    checkCycles: z.boolean().optional().default(false),
  })
  .optional()

const sourceSchema = z
  .object({
    define: z.custom<DefinePluginOptions>().optional(),
    alias: z.record(z.string(), z.string()).optional(),
    extensions: z.array(z.string()).optional(),
  })
  .optional()

const devSchema = z
  .object({
    port: z.number().int().min(1024).max(65535).optional(),
    proxy: z.unknown().optional(),
    https: z.union([z.boolean(), z.record(z.string(), z.unknown())]).optional(),
    pages: z.union([z.array(z.string()), z.literal(false)]).optional(),
  })
  .optional()

const ikarosPluginSchema = z
  .object({
    name: z.string().min(1),
    enforce: z.enum(['pre', 'post']).optional(),
    order: z.number().optional(),
    setup: z.custom((value) => typeof value === 'function'),
  })
  .strict()

export const configSchema = z
  .object({
    app: z
      .object({
        target: z.enum(['pc', 'mobile']).optional().default('pc'),
      })
      .optional(),
    log: z
      .object({
        level: z.enum(['normal', 'quiet']).optional().default('normal'),
      })
      .optional(),
    plugins: z.array(ikarosPluginSchema).optional(),
    bundle: z
      .object({
        adapter: z.enum(['rspack', 'vite']).optional().default('rspack'),
        rspack: rspackNamespaceSchema.optional(),
        vite: viteNamespaceSchema.optional(),
      })
      .optional(),
    source: sourceSchema,
    pages: z.custom<Pages>().optional(),
    dev: devSchema,
    output: outputSchema,
    library: librarySchema,
    electron: z.unknown().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const record = value as Record<string, unknown>
    for (const [field, message] of Object.entries(legacyFieldMessages)) {
      if (field in record) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message,
        })
      }
    }
  })
