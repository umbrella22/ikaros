import { describe, it, expect, vi } from 'vitest'
import { mergeUserConfig, checkDependency } from '../../src/node/shared/common'

describe('mergeUserConfig', () => {
  it('应浅合并顶层属性', () => {
    const target = { a: 1, b: 2 }
    const source = { b: 3, c: 4 }
    const result = mergeUserConfig(target, source)
    expect(result).toEqual({ a: 1, b: 3, c: 4 })
  })

  it('应深合并嵌套对象', () => {
    const target = { nested: { a: 1, b: 2 } }
    const source = { nested: { b: 3, c: 4 } }
    const result = mergeUserConfig(
      target as Record<string, unknown>,
      source as Record<string, unknown>,
    )
    expect(result).toEqual({ nested: { a: 1, b: 3, c: 4 } })
  })

  it('source 中的非对象值应覆盖 target 中的对象值', () => {
    const target = { key: { nested: true } } as Record<string, unknown>
    const source = { key: 'overwritten' } as Record<string, unknown>
    const result = mergeUserConfig(target, source)
    expect(result).toEqual({ key: 'overwritten' })
  })

  it('source 中的对象值应覆盖 target 中的非对象值', () => {
    const target = { key: 'string' } as Record<string, unknown>
    const source = { key: { nested: true } } as Record<string, unknown>
    const result = mergeUserConfig(target, source)
    expect(result).toEqual({ key: { nested: true } })
  })

  it('不应修改原始对象', () => {
    const target = { a: 1, nested: { b: 2 } }
    const source = { a: 10, nested: { c: 3 } }
    const targetCopy = JSON.parse(JSON.stringify(target))
    mergeUserConfig(
      target as Record<string, unknown>,
      source as Record<string, unknown>,
    )
    expect(target).toEqual(targetCopy)
  })

  it('应处理空对象', () => {
    const target = { a: 1 }
    const source = {} as Record<string, unknown>
    expect(mergeUserConfig(target, source)).toEqual({ a: 1 })
  })

  it('应处理多层嵌套', () => {
    const target = { a: { b: { c: 1, d: 2 } } }
    const source = { a: { b: { c: 10, e: 3 } } }
    const result = mergeUserConfig(
      target as Record<string, unknown>,
      source as Record<string, unknown>,
    )
    expect(result).toEqual({ a: { b: { c: 10, d: 2, e: 3 } } })
  })
})

describe('checkDependency', () => {
  it('应返回 true 当 package 存在时', () => {
    // vitest 是当前项目的依赖，一定存在
    expect(checkDependency('vitest')).toBe(true)
  })

  it('应返回 false 当 package 不存在时', () => {
    expect(checkDependency('__non_existent_package_xyz__')).toBe(false)
  })

  it('应支持自定义 context', () => {
    expect(checkDependency('vitest', process.cwd())).toBe(true)
  })

  it('应返回 false 当 package 在指定 context 下不存在时', () => {
    // 使用一个确定不存在的包名
    expect(
      checkDependency('__absolutely_not_a_real_pkg__', process.cwd()),
    ).toBe(false)
  })
})
