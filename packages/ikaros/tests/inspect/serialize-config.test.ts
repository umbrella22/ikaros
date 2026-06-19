import { describe, expect, it } from 'vitest'

import { serializeConfig } from '../../src/node/inspect/serialize-config'

describe('serializeConfig', () => {
  it('不应把共享引用误报为循环引用', () => {
    const shared = { value: 1 }

    expect(
      serializeConfig({
        left: shared,
        right: shared,
      }),
    ).toEqual({
      left: { value: 1 },
      right: { value: 1 },
    })
  })

  it('仍应识别真实循环引用', () => {
    const value: { self?: unknown } = {}
    value.self = value

    expect(serializeConfig(value)).toEqual({
      self: '[Circular -> $]',
    })
  })
})
