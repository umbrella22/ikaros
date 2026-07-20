import { describe, expect, it } from 'vitest'

import { applyAdapterCapabilities } from '../../src/node/build-plan'
import type { BuildPlan } from '../../src/node/build-plan'

const createPlan = (bundler: BuildPlan['bundler']): BuildPlan => ({
  id: 'web',
  command: 'build',
  platform: 'web',
  target: 'web',
  bundler,
  context: '/test/project',
  env: {},
  entries: {},
  source: {
    define: {},
    alias: {},
    extensions: ['.ts'],
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
    gzip: true,
    sourceMap: false,
    report: true,
    cache: true,
    checkCycles: true,
  },
  adapterOptions: {},
  capabilities: [],
  provenance: [],
  diagnostics: [],
})

describe('applyAdapterCapabilities', () => {
  it('Vite 应报告 output.cache 未支持，其余标准输出能力可用', () => {
    const [plan] = applyAdapterCapabilities([createPlan('vite')])

    expect(plan.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'output.cache',
          status: 'unsupported',
        }),
        expect.objectContaining({ id: 'output.gzip', status: 'supported' }),
        expect.objectContaining({ id: 'output.report', status: 'supported' }),
        expect.objectContaining({
          id: 'output.checkCycles',
          status: 'supported',
        }),
      ]),
    )
    expect(plan.diagnostics).toEqual([
      expect.objectContaining({
        level: 'warning',
        source: 'adapter-capabilities',
        message: expect.stringContaining('output.cache'),
      }),
    ])
  })

  it('Rspack 不应为同一组输出选项生成能力告警', () => {
    const [plan] = applyAdapterCapabilities([createPlan('rspack')])

    expect(plan.capabilities.every((item) => item.status === 'supported')).toBe(
      true,
    )
    expect(plan.diagnostics).toEqual([])
  })
})
