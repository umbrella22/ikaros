import { describe, expect, it } from 'vitest'

import { buildPlanToNormalizedConfig } from '../../src/node/build-plan'
import type { BuildPlan } from '../../src/node/build-plan'

const createPlan = (entryImport: string | string[]): BuildPlan => ({
  id: 'web',
  command: 'build',
  platform: 'web',
  target: 'web',
  bundler: 'rspack',
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
  adapterOptions: {},
  capabilities: [],
  provenance: [],
  diagnostics: [],
})

describe('buildPlanToNormalizedConfig', () => {
  it('应保留 BuildPlan 多入口数组', () => {
    const config = buildPlanToNormalizedConfig(
      createPlan(['/test/project/src/a.ts', '/test/project/src/b.ts']),
    )

    expect(config.pages.index.entry).toEqual([
      '/test/project/src/a.ts',
      '/test/project/src/b.ts',
    ])
  })
})
