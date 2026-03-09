import { describe, it, expect } from 'vitest'
import { createCdnExternals } from '../../src/node/plugins/cdn-plugin'

describe('createCdnExternals', () => {
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
})
