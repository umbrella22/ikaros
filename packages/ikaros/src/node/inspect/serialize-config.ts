export type SerializedInspectValue =
  | null
  | boolean
  | number
  | string
  | SerializedInspectValue[]
  | {
      [key: string]: SerializedInspectValue
    }

function serializeEntries(
  entries: Iterable<[string, unknown]>,
  stack: WeakMap<object, string>,
  path: string,
): Record<string, SerializedInspectValue> {
  const result: Record<string, SerializedInspectValue> = {}

  for (const [key, value] of entries) {
    result[key] = serializeConfig(value, stack, `${path}.${key}`)
  }

  return result
}

export function serializeConfig(
  value: unknown,
  stack: WeakMap<object, string> = new WeakMap(),
  path = '$',
): SerializedInspectValue {
  if (value === null) {
    return null
  }

  if (value === undefined) {
    return '[Undefined]'
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return Number.isNaN(value) ? '[NaN]' : value
  }

  if (typeof value === 'bigint') {
    return `${value}n`
  }

  if (typeof value === 'function') {
    return `[Function ${value.name || 'anonymous'}]`
  }

  if (typeof value === 'symbol') {
    return value.toString()
  }

  if (value instanceof RegExp) {
    return value.toString()
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack ?? '[No stack]',
    }
  }

  if (Array.isArray(value)) {
    return value.map((item, index) =>
      serializeConfig(item, stack, `${path}[${index}]`),
    )
  }

  if (typeof value !== 'object') {
    return String(value)
  }

  const previousPath = stack.get(value)
  if (previousPath) {
    return `[Circular -> ${previousPath}]`
  }

  stack.set(value, path)

  if (value instanceof Map) {
    const serialized: SerializedInspectValue = {
      __type: 'Map',
      entries: [...value.entries()].map(([key, item], index) => ({
        key: serializeConfig(key, stack, `${path}.entries[${index}].key`),
        value: serializeConfig(item, stack, `${path}.entries[${index}].value`),
      })),
    }
    stack.delete(value)
    return serialized
  }

  if (value instanceof Set) {
    const serialized: SerializedInspectValue = {
      __type: 'Set',
      values: [...value.values()].map((item, index) =>
        serializeConfig(item, stack, `${path}.values[${index}]`),
      ),
    }
    stack.delete(value)
    return serialized
  }

  const constructorName =
    'constructor' in value &&
    value.constructor &&
    typeof value.constructor === 'function'
      ? value.constructor.name
      : 'Object'

  const serialized = serializeEntries(Object.entries(value), stack, path)

  if (constructorName !== 'Object' && constructorName !== 'Array') {
    serialized.__type = constructorName
  }

  stack.delete(value)
  return serialized
}
