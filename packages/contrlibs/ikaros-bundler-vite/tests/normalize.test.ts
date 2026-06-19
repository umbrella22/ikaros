import { describe, expect, it } from 'vitest'

import {
  getOutDirPath,
  normalizeDefine,
  resolveRollupInput,
  sanitizeViteExtensions,
  toPluginsArray,
  toViteHttps,
  toViteProxy,
} from '../src/config/normalize'
import { createNormalizedConfig } from './test-utils'

// ─── normalizeDefine ────────────────────────────────────────────────────────

describe('normalizeDefine', () => {
  it('should return undefined for undefined input', () => {
    expect(normalizeDefine(undefined)).toBeUndefined()
  })

  it('should JSON.stringify string values', () => {
    const result = normalizeDefine({ APP_NAME: 'hello' })
    expect(result).toEqual({ APP_NAME: '"hello"' })
  })

  it('should pass through boolean values', () => {
    const result = normalizeDefine({ __DEV__: true, __PROD__: false })
    expect(result).toEqual({ __DEV__: true, __PROD__: false })
  })

  it('should pass through number values', () => {
    const result = normalizeDefine({ VERSION: 42 })
    expect(result).toEqual({ VERSION: 42 })
  })

  it('should pass through null', () => {
    const result = normalizeDefine({ EMPTY: null })
    expect(result).toEqual({ EMPTY: null })
  })

  it('should JSON.stringify object values to avoid [object Object]', () => {
    const result = normalizeDefine({ META: { major: 1, minor: 2 } })
    expect(result).toEqual({ META: '{"major":1,"minor":2}' })
  })

  it('should JSON.stringify array values', () => {
    const result = normalizeDefine({ FEATURES: ['a', 'b'] })
    expect(result).toEqual({ FEATURES: '["a","b"]' })
  })

  it('should handle mixed value types', () => {
    const result = normalizeDefine({
      NAME: 'app',
      DEBUG: true,
      COUNT: 3,
      META: { v: 1 },
      NOTHING: null,
    })
    expect(result).toEqual({
      NAME: '"app"',
      DEBUG: true,
      COUNT: 3,
      META: '{"v":1}',
      NOTHING: null,
    })
  })
})

// ─── sanitizeViteExtensions ─────────────────────────────────────────────────

describe('sanitizeViteExtensions', () => {
  it('should return undefined for undefined input', () => {
    expect(sanitizeViteExtensions(undefined)).toBeUndefined()
  })

  it('should return undefined for empty array', () => {
    expect(sanitizeViteExtensions([])).toBeUndefined()
  })

  it('should expand rspack spread syntax "..." to Vite defaults', () => {
    const result = sanitizeViteExtensions(['.js', '...', '.ts'])
    expect(result).toEqual([
      '.js',
      '.mjs',
      '.mts',
      '.ts',
      '.jsx',
      '.tsx',
      '.json',
    ])
  })

  it('should filter out extensions not starting with "."', () => {
    const result = sanitizeViteExtensions(['.js', 'ts', '.vue'])
    expect(result).toEqual(['.js', '.vue'])
  })

  it('should filter out empty strings', () => {
    const result = sanitizeViteExtensions(['.js', '', '.ts'])
    expect(result).toEqual(['.js', '.ts'])
  })

  it('should deduplicate extensions', () => {
    const result = sanitizeViteExtensions(['.js', '.ts', '.js'])
    expect(result).toEqual(['.js', '.ts'])
  })

  it('should return Vite defaults when input only contains spread syntax and invalid items', () => {
    const result = sanitizeViteExtensions(['...', '', 'no-dot'])
    expect(result).toEqual([
      '.mjs',
      '.js',
      '.mts',
      '.ts',
      '.jsx',
      '.tsx',
      '.json',
    ])
  })

  it('should return undefined when all items are invalid and no spread syntax is provided', () => {
    const result = sanitizeViteExtensions(['', 'no-dot'])
    expect(result).toBeUndefined()
  })
})

// ─── getOutDirPath ──────────────────────────────────────────────────────────

describe('getOutDirPath', () => {
  const resolveContext = (...paths: string[]) => `/root/${paths.join('/')}`

  it('should default to "dist"', () => {
    expect(
      getOutDirPath({
        config: createNormalizedConfig(),
        resolveContext,
      }),
    ).toBe('/root/dist')
  })

  it('should use custom outDirName', () => {
    expect(
      getOutDirPath({
        config: createNormalizedConfig({
          build: { outDirName: 'output' },
        }),
        resolveContext,
      }),
    ).toBe('/root/output')
  })

  it('should use electron renderer path when isElectron', () => {
    expect(
      getOutDirPath({
        config: createNormalizedConfig({ isElectron: true }),
        resolveContext,
      }),
    ).toBe('/root/dist/electron/renderer')
  })

  it('should prefer electron path over custom outDirName', () => {
    expect(
      getOutDirPath({
        config: createNormalizedConfig({
          build: { outDirName: 'output' },
          isElectron: true,
        }),
        resolveContext,
      }),
    ).toBe('/root/dist/electron/renderer')
  })

  it('should ignore empty outDirName', () => {
    expect(
      getOutDirPath({
        config: createNormalizedConfig({
          build: { outDirName: '' },
        }),
        resolveContext,
      }),
    ).toBe('/root/dist')
  })
})

// ─── resolveRollupInput ─────────────────────────────────────────────────────

describe('resolveRollupInput', () => {
  const context = '/project'

  it('should return undefined for single page', () => {
    const pages = {
      index: { html: '/project/index.html', entry: '/src/index.ts' },
    }
    expect(
      resolveRollupInput({ pages, enablePages: undefined, context }),
    ).toBeUndefined()
  })

  it('should return input map for a single custom html page', () => {
    const pages = {
      index: {
        html: '/project/src/renderer/index.html',
        entry: '/src/index.ts',
      },
    }

    expect(
      resolveRollupInput({ pages, enablePages: undefined, context }),
    ).toEqual({
      index: '/project/src/renderer/index.html',
    })
  })

  it('should return input map for multiple pages', () => {
    const pages = {
      index: { html: '/index.html', entry: '/src/index.ts' },
      about: { html: '/about.html', entry: '/src/about.ts' },
    }
    expect(
      resolveRollupInput({ pages, enablePages: undefined, context }),
    ).toEqual({
      index: '/index.html',
      about: '/about.html',
    })
  })

  it('should filter pages by enablePages', () => {
    const pages = {
      index: { html: '/index.html', entry: '/src/index.ts' },
      about: { html: '/about.html', entry: '/src/about.ts' },
      contact: { html: '/contact.html', entry: '/src/contact.ts' },
    }
    expect(
      resolveRollupInput({
        pages,
        enablePages: ['index', 'contact'],
        context,
      }),
    ).toEqual({
      index: '/index.html',
      contact: '/contact.html',
    })
  })

  it('should return undefined if enablePages filters to single page', () => {
    const pages = {
      index: { html: '/project/index.html', entry: '/src/index.ts' },
      about: { html: '/about.html', entry: '/src/about.ts' },
    }
    expect(
      resolveRollupInput({ pages, enablePages: ['index'], context }),
    ).toBeUndefined()
  })

  it('should keep custom html when enablePages filters to a single page', () => {
    const pages = {
      index: { html: '/project/index.html', entry: '/src/index.ts' },
      renderer: {
        html: '/project/src/renderer/index.html',
        entry: '/src/renderer.ts',
      },
    }

    expect(
      resolveRollupInput({ pages, enablePages: ['renderer'], context }),
    ).toEqual({
      renderer: '/project/src/renderer/index.html',
    })
  })

  it('should use all pages when enablePages is false', () => {
    const pages = {
      index: { html: '/index.html', entry: '/src/index.ts' },
      about: { html: '/about.html', entry: '/src/about.ts' },
    }
    expect(resolveRollupInput({ pages, enablePages: false, context })).toEqual(
      {
        index: '/index.html',
        about: '/about.html',
      },
    )
  })
})

// ─── toViteProxy ────────────────────────────────────────────────────────────

describe('toViteProxy', () => {
  it('should return undefined for falsy values', () => {
    expect(toViteProxy(undefined)).toBeUndefined()
    expect(toViteProxy(null)).toBeUndefined()
    expect(toViteProxy('')).toBeUndefined()
  })

  it('should map proxy arrays with string context', () => {
    expect(
      toViteProxy([
        {
          context: '/api',
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      ]),
    ).toEqual({
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    })
  })

  it('should map proxy arrays with context arrays', () => {
    expect(
      toViteProxy([
        {
          context: ['/api', '/auth'],
          target: 'http://localhost:3000',
        },
      ]),
    ).toEqual({
      '/api': {
        target: 'http://localhost:3000',
      },
      '/auth': {
        target: 'http://localhost:3000',
      },
    })
  })

  it('should prefer pathFilter when provided', () => {
    expect(
      toViteProxy([
        {
          context: '/ignored',
          pathFilter: '/api',
          target: 'http://localhost:3000',
        },
      ]),
    ).toEqual({
      '/api': {
        target: 'http://localhost:3000',
      },
    })
  })

  it('should skip dynamic or unmappable proxy array items', () => {
    expect(
      toViteProxy([
        1,
        () => ({ context: '/api', target: 'http://localhost:3000' }),
        { context: /^\/api/, target: 'http://localhost:3000' },
      ]),
    ).toBeUndefined()
  })

  it('should pass through valid proxy objects', () => {
    const proxy = { '/api': 'http://localhost:3000' }
    expect(toViteProxy(proxy)).toBe(proxy)
  })
})

// ─── toViteHttps ────────────────────────────────────────────────────────────

describe('toViteHttps', () => {
  it('should return {} for true', () => {
    expect(toViteHttps(true)).toEqual({})
  })

  it('should return undefined for false', () => {
    expect(toViteHttps(false)).toBeUndefined()
  })

  it('should return undefined for non-object', () => {
    expect(toViteHttps(undefined)).toBeUndefined()
    expect(toViteHttps(null)).toBeUndefined()
    expect(toViteHttps(42)).toBeUndefined()
  })

  it('should pass through HTTPS options object', () => {
    const opts = { key: 'key', cert: 'cert' }
    expect(toViteHttps(opts)).toBe(opts)
  })
})

// ─── toPluginsArray ─────────────────────────────────────────────────────────

describe('toPluginsArray', () => {
  it('should return empty array for undefined', () => {
    expect(toPluginsArray(undefined)).toEqual([])
  })

  it('should wrap single plugin in array', () => {
    const plugin = { name: 'test' }
    expect(toPluginsArray(plugin)).toEqual([plugin])
  })

  it('should pass through plugin array', () => {
    const plugins = [{ name: 'a' }, { name: 'b' }]
    expect(toPluginsArray(plugins)).toBe(plugins)
  })
})
