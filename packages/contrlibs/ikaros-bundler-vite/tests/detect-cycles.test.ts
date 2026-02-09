import { describe, expect, it } from 'vitest'

import { detectCycles } from '../src/plugins/vite-build-plugin'
import type { DetectCyclesContext } from '../src/plugins/vite-build-plugin'

const createMockContext = (
  graph: Record<string, string[]>,
): DetectCyclesContext => ({
  getModuleIds: () => Object.keys(graph)[Symbol.iterator](),
  getModuleInfo: (id: string) => {
    const deps = graph[id]
    if (!deps) return null
    return { id, importedIds: deps }
  },
})

describe('detectCycles', () => {
  it('should return empty array for acyclic graph', () => {
    const ctx = createMockContext({
      'a.ts': ['b.ts'],
      'b.ts': ['c.ts'],
      'c.ts': [],
    })
    expect(detectCycles(ctx)).toEqual([])
  })

  it('should detect simple A -> B -> A cycle', () => {
    const ctx = createMockContext({
      'a.ts': ['b.ts'],
      'b.ts': ['a.ts'],
    })
    const cycles = detectCycles(ctx)
    expect(cycles.length).toBeGreaterThanOrEqual(1)
    // At least one cycle should contain both a.ts and b.ts
    const hasExpectedCycle = cycles.some(
      (c) => c.includes('a.ts') && c.includes('b.ts'),
    )
    expect(hasExpectedCycle).toBe(true)
  })

  it('should detect self-cycle A -> A', () => {
    const ctx = createMockContext({
      'a.ts': ['a.ts'],
    })
    const cycles = detectCycles(ctx)
    expect(cycles.length).toBe(1)
    expect(cycles[0]).toEqual(['a.ts', 'a.ts'])
  })

  it('should detect A -> B -> C -> A cycle', () => {
    const ctx = createMockContext({
      'a.ts': ['b.ts'],
      'b.ts': ['c.ts'],
      'c.ts': ['a.ts'],
    })
    const cycles = detectCycles(ctx)
    expect(cycles.length).toBeGreaterThanOrEqual(1)
    const hasTriangleCycle = cycles.some(
      (c) => c.includes('a.ts') && c.includes('b.ts') && c.includes('c.ts'),
    )
    expect(hasTriangleCycle).toBe(true)
  })

  it('should not report duplicate cycles', () => {
    const ctx = createMockContext({
      'a.ts': ['b.ts'],
      'b.ts': ['a.ts'],
    })
    const cycles = detectCycles(ctx)
    const signatures = cycles.map((c) => c.join(' -> '))
    const uniqueSignatures = new Set(signatures)
    expect(signatures.length).toBe(uniqueSignatures.size)
  })

  it('should ignore node_modules', () => {
    const ctx = createMockContext({
      'a.ts': ['node_modules/lib/index.js'],
      'node_modules/lib/index.js': ['a.ts'],
    })
    const cycles = detectCycles(ctx)
    expect(cycles).toEqual([])
  })

  it('should handle empty graph', () => {
    const ctx = createMockContext({})
    expect(detectCycles(ctx)).toEqual([])
  })

  it('should handle disconnected components', () => {
    const ctx = createMockContext({
      'a.ts': ['b.ts'],
      'b.ts': [],
      'c.ts': ['d.ts'],
      'd.ts': ['c.ts'],
    })
    const cycles = detectCycles(ctx)
    expect(cycles.length).toBeGreaterThanOrEqual(1)
    // Cycle should be in c-d component, not a-b
    const hasCDCycle = cycles.some(
      (c) => c.includes('c.ts') && c.includes('d.ts'),
    )
    expect(hasCDCycle).toBe(true)
  })

  it('should handle multiple independent cycles', () => {
    const ctx = createMockContext({
      'a.ts': ['b.ts'],
      'b.ts': ['a.ts'],
      'c.ts': ['d.ts'],
      'd.ts': ['c.ts'],
    })
    const cycles = detectCycles(ctx)
    expect(cycles.length).toBeGreaterThanOrEqual(2)
  })
})
