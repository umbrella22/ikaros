import type { Plugin, RuleSetRule } from '@rspack/core'

export type RspackSemanticKind = 'rule' | 'plugin'

export interface RspackSemanticItem<TValue> {
  id: string
  value: TValue
  disabled?: boolean
}

export interface RspackSemanticOperation {
  kind: RspackSemanticKind
  operation: string
  target: string
}

export interface RspackSemanticRegistry<TValue> {
  readonly kind: RspackSemanticKind
  get: (id: string) => TValue | undefined
  has: (id: string) => boolean
  set: (id: string, value: TValue) => void
  append: (id: string, value: TValue) => void
  prepend: (id: string, value: TValue) => void
  before: (targetId: string, id: string, value: TValue) => void
  after: (targetId: string, id: string, value: TValue) => void
  disable: (id: string) => void
  remove: (id: string) => void
  entries: () => RspackSemanticItem<TValue>[]
  values: () => TValue[]
  operations: () => RspackSemanticOperation[]
}

export type RspackRuleRegistry = RspackSemanticRegistry<RuleSetRule>
export type RspackPluginValue = Plugin | Plugin[]
export type RspackPluginRegistry = RspackSemanticRegistry<RspackPluginValue>

export function createRspackSemanticRegistry<TValue>(
  kind: RspackSemanticKind,
  items: RspackSemanticItem<TValue>[] = [],
): RspackSemanticRegistry<TValue> {
  const registryItems = [...items]
  const operations: RspackSemanticOperation[] = []

  const record = (operation: string, target: string) => {
    operations.push({ kind, operation, target })
  }

  const findIndex = (id: string) =>
    registryItems.findIndex((item) => item.id === id)

  const findEnabledIndex = (id: string) =>
    registryItems.findIndex((item) => item.id === id && !item.disabled)

  const upsertAt = (index: number, item: RspackSemanticItem<TValue>) => {
    const existingIndex = findIndex(item.id)
    let nextIndex = index
    if (existingIndex >= 0) {
      registryItems.splice(existingIndex, 1)
      if (existingIndex < nextIndex) {
        nextIndex -= 1
      }
    }
    registryItems.splice(nextIndex, 0, item)
  }

  return {
    kind,

    get(id) {
      return registryItems.find((item) => item.id === id && !item.disabled)
        ?.value
    },

    has(id) {
      return findEnabledIndex(id) >= 0
    },

    set(id, value) {
      const index = findIndex(id)
      if (index >= 0) {
        registryItems[index] = { id, value }
      } else {
        registryItems.push({ id, value })
      }
      record('set', id)
    },

    append(id, value) {
      upsertAt(registryItems.length, { id, value })
      record('append', id)
    },

    prepend(id, value) {
      upsertAt(0, { id, value })
      record('prepend', id)
    },

    before(targetId, id, value) {
      const targetIndex = findIndex(targetId)
      upsertAt(targetIndex >= 0 ? targetIndex : registryItems.length, {
        id,
        value,
      })
      record('before', `${id}->${targetId}`)
    },

    after(targetId, id, value) {
      const targetIndex = findIndex(targetId)
      upsertAt(targetIndex >= 0 ? targetIndex + 1 : registryItems.length, {
        id,
        value,
      })
      record('after', `${id}->${targetId}`)
    },

    disable(id) {
      const index = findIndex(id)
      if (index >= 0) {
        registryItems[index] = {
          ...registryItems[index],
          disabled: true,
        }
      }
      record('disable', id)
    },

    remove(id) {
      const index = findIndex(id)
      if (index >= 0) {
        registryItems.splice(index, 1)
      }
      record('remove', id)
    },

    entries() {
      return [...registryItems]
    },

    values() {
      return registryItems
        .filter((item) => !item.disabled)
        .map((item) => item.value)
    },

    operations() {
      return [...operations]
    },
  }
}
