import { describe, expect, it } from 'vitest'

import { buildPlanToNormalizedConfig } from '../src/plan-compat'
import type { BuildPlan } from '../src/types'

const createPlan = (entryImport: string | string[]): BuildPlan => ({
  id: 'web',
  command: 'build',
  platform: 'web',
  target: 'web',
  bundler: 'vite',
  context: '/test/project',
  env: {},
  entries: {
    index: {
      html: '/test/project/index.html',
      import: entryImport,
    },
  },
  source: {
    define: {},
    alias: {},
    extensions: ['.ts', '.js'],
    framework: 'none',
    browserslist: 'defaults',
  },
  dev: {
    port: 3000,
    https: false,
    pages: false,
  },
  output: {
    base: '/',
    dir: 'dist',
    assetsDir: '',
    gzip: false,
    sourceMap: false,
    report: false,
    cache: false,
    checkCycles: false,
  },
  adapterOptions: {
    vite: {
      plugins: [],
    },
  },
  provenance: [],
  diagnostics: [],
})

describe('buildPlanToNormalizedConfig', () => {
  it('Vite pages 不应写入有损截断后的 entry 字段', () => {
    const config = buildPlanToNormalizedConfig(
      createPlan(['/test/project/src/a.ts', '/test/project/src/b.ts']),
    )

    expect(config.pages.index).toEqual({
      html: '/test/project/index.html',
    })
  })
})
