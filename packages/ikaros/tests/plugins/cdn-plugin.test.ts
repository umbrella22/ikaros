import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCdnExternals } from '../../src/node/plugins/cdn-plugin'

describe('createCdnExternals', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('应从模块列表生成 externals 映射', () => {
    const modules = [
      { name: 'react', var: 'React' },
      { name: 'react-dom', var: 'ReactDOM' },
    ]
    const result = createCdnExternals(modules)
    expect(result).toEqual({
      react: 'React',
      'react-dom': 'ReactDOM',
    })
  })

  it('当未指定 var 时应使用 name 作为全局变量名', () => {
    const modules = [{ name: 'lodash' }]
    const result = createCdnExternals(modules)
    expect(result).toEqual({ lodash: 'lodash' })
  })

  it('应排除 cssOnly 模块', () => {
    const modules = [
      { name: 'vue', var: 'Vue' },
      { name: 'normalize.css', cssOnly: true },
    ]
    const result = createCdnExternals(modules)
    expect(result).toEqual({ vue: 'Vue' })
    expect(result).not.toHaveProperty('normalize.css')
  })

  it('空数组应返回空对象', () => {
    expect(createCdnExternals([])).toEqual({})
  })

  it('应处理混合模块配置', () => {
    const modules = [
      { name: 'vue', var: 'Vue', version: '3.3.0', path: 'dist/vue.global.js' },
      { name: 'element-plus', var: 'ElementPlus', cssOnly: false },
      { name: 'normalize.css', cssOnly: true, style: 'normalize.css' },
    ]
    const result = createCdnExternals(modules)
    expect(result).toEqual({
      vue: 'Vue',
      'element-plus': 'ElementPlus',
    })
  })
})

describe('CdnPlugin', () => {
  it('应使用默认选项初始化', async () => {
    const mod = await import('../../src/node/plugins/cdn-plugin')
    const CdnPlugin = mod.default
    const plugin = new CdnPlugin({
      modules: [{ name: 'react', var: 'React' }],
    })
    expect(plugin).toBeDefined()
    expect(typeof plugin.apply).toBe('function')
  })

  it('应基于传入的 context 解析模块版本', async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'ikaros-cdn-'))
    const packageRoot = join(fixtureRoot, 'node_modules', 'react')

    await mkdir(packageRoot, { recursive: true })
    await writeFile(
      join(packageRoot, 'package.json'),
      JSON.stringify({ name: 'react', version: '9.9.9' }),
    )

    const mod = await import('../../src/node/plugins/cdn-plugin')
    const CdnPlugin = mod.default
    const plugin = new CdnPlugin({
      context: fixtureRoot,
      modules: [{ name: 'react', var: 'React' }],
    }) as unknown as {
      getModuleVersion: (name: string) => string
    }

    expect(plugin.getModuleVersion('react')).toBe('9.9.9')

    await rm(fixtureRoot, { recursive: true, force: true })
  })
})
