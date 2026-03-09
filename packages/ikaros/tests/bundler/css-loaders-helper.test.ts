import { describe, it, expect } from 'vitest'
import { buildCssLoaders } from '../../src/node/bundler/rspack/css-loaders-helper'

describe('buildCssLoaders', () => {
  it('应返回所有 CSS 预处理器的 loader 配置', () => {
    const loaders = buildCssLoaders('development')
    const extensions = loaders.map((l) => {
      const match = l.test.source.match(/\\.(\w+)\$/)
      return match?.[1]
    })
    expect(extensions).toContain('less')
    expect(extensions).toContain('sass')
    expect(extensions).toContain('scss')
    expect(extensions).toContain('stylus')
    expect(extensions).toContain('styl')
    expect(extensions).toContain('css')
  })

  it('每个 loader 规则应包含 type: css/auto', () => {
    const loaders = buildCssLoaders('development')
    for (const loader of loaders) {
      expect(loader.type).toBe('css/auto')
    }
  })

  it('每个 loader 规则应包含 use 数组', () => {
    const loaders = buildCssLoaders('development')
    for (const loader of loaders) {
      expect(Array.isArray(loader.use)).toBe(true)
      expect(loader.use.length).toBeGreaterThan(0)
    }
  })

  it('CSS loader 应只包含 lightningcss-loader', () => {
    const loaders = buildCssLoaders('development')
    const cssLoader = loaders.find((l) => l.test.source === '\\.css$')
    expect(cssLoader).toBeDefined()
    expect(cssLoader!.use).toHaveLength(1)
    expect(cssLoader!.use[0].loader).toContain('lightningcss-loader')
  })

  it('LESS loader 应包含 lightningcss-loader 和 less-loader', () => {
    const loaders = buildCssLoaders('development')
    const lessLoader = loaders.find((l) => l.test.source === '\\.less$')
    expect(lessLoader).toBeDefined()
    expect(lessLoader!.use).toHaveLength(2)
    expect(lessLoader!.use[0].loader).toContain('lightningcss-loader')
    expect(lessLoader!.use[1].loader).toContain('less-loader')
  })

  it('SCSS loader 应包含 sass-loader 并使用 modern-compiler api', () => {
    const loaders = buildCssLoaders('development')
    const scssLoader = loaders.find((l) => l.test.source === '\\.scss$')
    expect(scssLoader).toBeDefined()
    const sassUse = scssLoader!.use[1]
    expect(sassUse.loader).toContain('sass-loader')
    expect(sassUse.options?.sassOptions?.api).toBe('modern-compiler')
  })

  it('SASS loader 应使用 indentedSyntax', () => {
    const loaders = buildCssLoaders('development')
    const sassLoader = loaders.find((l) => l.test.source === '\\.sass$')
    expect(sassLoader).toBeDefined()
    const sassUse = sassLoader!.use[1]
    expect(sassUse.options?.sassOptions?.indentedSyntax).toBe(true)
  })

  it('应传递 sourceMap 选项到预处理器 loader', () => {
    const loaders = buildCssLoaders('development', { sourceMap: true })
    const lessLoader = loaders.find((l) => l.test.source === '\\.less$')
    expect(lessLoader!.use[1].options?.sourceMap).toBe(true)
  })

  it('应传递 lightningcss 选项', () => {
    const loaders = buildCssLoaders('development', {
      lightningcss: { targets: 'defaults' } as Record<string, unknown>,
    })
    const cssLoader = loaders.find((l) => l.test.source === '\\.css$')
    expect(cssLoader!.use[0].options?.targets).toBe('defaults')
  })
})
