import { describe, expect, it } from 'vitest'

import { createRspackSemanticRegistry } from '../../src/node/bundler/rspack/semantic-registry'

describe('createRspackSemanticRegistry', () => {
  it('重定位已存在 id 时应保持 before/after 语义', () => {
    const registry = createRspackSemanticRegistry('rule', [
      { id: 'A', value: 'A' },
      { id: 'B', value: 'B' },
      { id: 'C', value: 'C' },
    ])

    registry.before('C', 'A', 'A2')
    expect(registry.values()).toEqual(['B', 'A2', 'C'])

    registry.after('B', 'A', 'A3')
    expect(registry.values()).toEqual(['B', 'A3', 'C'])
  })

  it('has/get/values 应排除 disabled 项而 entries 保留完整快照', () => {
    const registry = createRspackSemanticRegistry('plugin', [
      { id: 'enabled', value: 'enabled' },
      { id: 'disabled', value: 'disabled' },
    ])

    registry.disable('disabled')

    expect(registry.has('enabled')).toBe(true)
    expect(registry.has('disabled')).toBe(false)
    expect(registry.get('disabled')).toBeUndefined()
    expect(registry.values()).toEqual(['enabled'])
    expect(registry.entries()).toEqual([
      { id: 'enabled', value: 'enabled' },
      { id: 'disabled', value: 'disabled', disabled: true },
    ])
  })
})
