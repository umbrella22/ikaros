import { describe, expect, it } from 'vitest'

import {
  CreateMpaAssets,
  createMpaEntry,
} from '../../src/node/bundler/rspack/loader-plugin-helper'

describe('CreateMpaAssets', () => {
  const pages = {
    index: {
      html: '/test/project/index.html',
      entry: '/test/project/src/index.ts',
    },
    admin: {
      html: '/test/project/admin.html',
      entry: '/test/project/src/admin.ts',
    },
  }

  it('enablePages 全部不存在时不应回退到全部页面', () => {
    const helper = new CreateMpaAssets({
      pages,
      enablePages: ['missing'],
    })

    const result = helper.create()

    expect(result.entry).toEqual({})
    expect(result.plugins).toEqual([])
    expect(helper.warnings).toEqual([
      {
        source: 'enable-pages',
        message: '当前设置页面missing不存在',
      },
    ])
  })

  it('createMpaEntry 应只生成 entry 不构造 html 插件或 warning', () => {
    const entry = createMpaEntry({
      pages,
      enablePages: ['index'],
    })

    expect(entry).toEqual({
      index: {
        import: '/test/project/src/index.ts',
        library: undefined,
      },
    })
  })
})
