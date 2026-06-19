import { dirname, isAbsolute, resolve } from 'node:path'

import fsp from 'node:fs/promises'
import MagicString from 'magic-string'
import { parseSync } from 'oxc-parser'

type AstNode = Record<string, unknown> & {
  type?: string
  start?: number
  end?: number
}

type ObjectExpressionNode = AstNode & {
  type: 'ObjectExpression'
  properties: AstNode[]
}

type PropertyNode = AstNode & {
  type: 'Property'
  key: AstNode
  value: AstNode
  computed?: boolean
  method?: boolean
  shorthand?: boolean
}

export interface MigrateConfigDiagnostic {
  level: 'info' | 'warning' | 'error'
  message: string
  location?: {
    start: number
    end: number
  }
}

export interface MigrateConfigResult {
  code: string
  changed: boolean
  diagnostics: MigrateConfigDiagnostic[]
}

export interface MigrateConfigFileParams {
  configFile: string
  context?: string
  write?: boolean
  output?: string
}

export interface MigrateConfigFileResult extends MigrateConfigResult {
  inputFile: string
  outputFile?: string
}

const LEGACY_TOP_LEVEL_FIELDS = new Set([
  'target',
  'quiet',
  'bundler',
  'define',
  'resolve',
  'enablePages',
  'server',
  'build',
  'rspack',
  'vite',
])

const RETAINED_TOP_LEVEL_FIELDS = [
  'plugins',
  'pages',
  'library',
  'electron',
] as const

const V3_NAMESPACE_FIELDS = [
  'app',
  'log',
  'bundle',
  'source',
  'dev',
  'output',
] as const

function isNode(value: unknown): value is AstNode {
  return !!value && typeof value === 'object' && 'type' in value
}

function isObjectExpression(value: unknown): value is ObjectExpressionNode {
  return isNode(value) && value.type === 'ObjectExpression'
}

function isProperty(value: unknown): value is PropertyNode {
  return isNode(value) && value.type === 'Property'
}

function codeOf(code: string, node: AstNode | undefined): string {
  if (!node || typeof node.start !== 'number' || typeof node.end !== 'number') {
    return ''
  }
  return code.slice(node.start, node.end)
}

function getKeyName(key: AstNode, computed?: boolean): string | undefined {
  if (computed) return undefined
  if (key.type === 'Identifier' && typeof key.name === 'string') {
    return key.name
  }
  if (key.type === 'Literal' && typeof key.value === 'string') {
    return key.value
  }
  return undefined
}

function readObjectProperties(
  node: ObjectExpressionNode,
  diagnostics: MigrateConfigDiagnostic[],
): Map<string, PropertyNode> {
  const props = new Map<string, PropertyNode>()

  for (const item of node.properties) {
    if (!isProperty(item)) {
      diagnostics.push({
        level: 'warning',
        message: '配置对象包含 spread 或非标准属性，迁移器会保留可静态识别的字段；请人工检查结果。',
        location:
          typeof item.start === 'number' && typeof item.end === 'number'
            ? { start: item.start, end: item.end }
            : undefined,
      })
      continue
    }

    const name = getKeyName(item.key, item.computed)
    if (!name) {
      diagnostics.push({
        level: 'warning',
        message: '配置对象包含计算属性名，无法静态迁移该字段。',
        location:
          typeof item.start === 'number' && typeof item.end === 'number'
            ? { start: item.start, end: item.end }
            : undefined,
      })
      continue
    }

    props.set(name, item)
  }

  return props
}

function literalBooleanCode(code: string, node: AstNode | undefined): string {
  if (node?.type === 'Literal' && typeof node.value === 'boolean') {
    return node.value ? "'quiet'" : "'normal'"
  }

  return `${codeOf(code, node)} ? 'quiet' : 'normal'`
}

function propertyText(name: string, value: string): string {
  return `${name}: ${value}`
}

function createObjectText(
  code: string,
  properties: Array<[string, AstNode]>,
  rename: Record<string, string> = {},
): string {
  const body = properties.map(([name, value]) =>
    propertyText(rename[name] ?? name, codeOf(code, value)),
  )

  return `{ ${body.join(', ')} }`
}

function createObjectEntriesFromObjectExpression(params: {
  code: string
  source?: AstNode
  rename?: Record<string, string>
  diagnostics: MigrateConfigDiagnostic[]
}): string[] | undefined {
  const { code, source, rename = {}, diagnostics } = params
  if (!source) return undefined

  if (!isObjectExpression(source)) {
    return undefined
  }

  const entries: string[] = []
  for (const item of source.properties) {
    if (!isProperty(item)) {
      diagnostics.push({
        level: 'warning',
        message: '对象内包含 spread 或非标准属性，迁移后请人工确认。',
        location:
          typeof item.start === 'number' && typeof item.end === 'number'
            ? { start: item.start, end: item.end }
            : undefined,
      })
      continue
    }

    const name = getKeyName(item.key, item.computed)
    if (!name) {
      diagnostics.push({
        level: 'warning',
        message: '对象内包含计算属性名，无法静态迁移该字段。',
        location:
          typeof item.start === 'number' && typeof item.end === 'number'
            ? { start: item.start, end: item.end }
            : undefined,
      })
      continue
    }

    entries.push(propertyText(rename[name] ?? name, codeOf(code, item.value)))
  }

  return entries
}

function createObjectFromObjectExpression(params: {
  code: string
  source?: AstNode
  rename?: Record<string, string>
  diagnostics: MigrateConfigDiagnostic[]
}): string | undefined {
  const { code, source, rename = {}, diagnostics } = params
  if (!source) return undefined

  if (!isObjectExpression(source)) {
    diagnostics.push({
      level: 'warning',
      message: '遇到非对象表达式，无法展开内部字段；已按原表达式保留。',
      location:
        typeof source.start === 'number' && typeof source.end === 'number'
          ? { start: source.start, end: source.end }
          : undefined,
    })
    return codeOf(code, source)
  }

  const properties: Array<[string, AstNode]> = []
  for (const item of source.properties) {
    if (!isProperty(item)) {
      diagnostics.push({
        level: 'warning',
        message: '对象内包含 spread 或非标准属性，迁移后请人工确认。',
        location:
          typeof item.start === 'number' && typeof item.end === 'number'
            ? { start: item.start, end: item.end }
            : undefined,
      })
      continue
    }

    const name = getKeyName(item.key, item.computed)
    if (name) {
      properties.push([name, item.value])
    } else {
      diagnostics.push({
        level: 'warning',
        message: '对象内包含计算属性名，无法静态迁移该字段。',
        location:
          typeof item.start === 'number' && typeof item.end === 'number'
            ? { start: item.start, end: item.end }
            : undefined,
      })
    }
  }

  return createObjectText(code, properties, rename)
}

function mergeNamespaceText(params: {
  code: string
  existing?: AstNode
  entries: string[]
}): string | undefined {
  const { code, existing, entries } = params
  if (!existing && entries.length === 0) return undefined

  const body: string[] = []
  if (existing) {
    body.push(`...(${codeOf(code, existing)})`)
  }
  body.push(...entries)

  return `{ ${body.join(', ')} }`
}

function transformConfigObject(
  code: string,
  node: ObjectExpressionNode,
): {
  text: string
  diagnostics: MigrateConfigDiagnostic[]
  changed: boolean
} {
  const diagnostics: MigrateConfigDiagnostic[] = []
  const props = readObjectProperties(node, diagnostics)
  const hasLegacy = [...props.keys()].some((key) =>
    LEGACY_TOP_LEVEL_FIELDS.has(key),
  )

  if (!hasLegacy) {
    diagnostics.push({
      level: 'info',
      message: '未发现 v2 顶层字段，配置看起来已经是 v3 结构。',
      location:
        typeof node.start === 'number' && typeof node.end === 'number'
          ? { start: node.start, end: node.end }
          : undefined,
    })
    return { text: codeOf(code, node), diagnostics, changed: false }
  }

  const outputEntries: string[] = []
  const addNamespace = (name: string, text: string | undefined) => {
    if (text) outputEntries.push(propertyText(name, text))
  }

  addNamespace(
    'app',
    mergeNamespaceText({
      code,
      existing: props.get('app')?.value,
      entries: props.has('target')
        ? [propertyText('target', codeOf(code, props.get('target')?.value))]
        : [],
    }),
  )

  addNamespace(
    'log',
    mergeNamespaceText({
      code,
      existing: props.get('log')?.value,
      entries: props.has('quiet')
        ? [propertyText('level', literalBooleanCode(code, props.get('quiet')?.value))]
        : [],
    }),
  )

  for (const field of RETAINED_TOP_LEVEL_FIELDS) {
    const prop = props.get(field)
    if (prop) {
      outputEntries.push(propertyText(field, codeOf(code, prop.value)))
    }
  }

  const bundleEntries: string[] = []
  if (props.has('bundler')) {
    bundleEntries.push(
      propertyText('adapter', codeOf(code, props.get('bundler')?.value)),
    )
  }

  const rspackText = createObjectFromObjectExpression({
    code,
    source: props.get('rspack')?.value,
    rename: {
      cdnOptions: 'cdn',
    },
    diagnostics,
  })
  if (rspackText) bundleEntries.push(propertyText('rspack', rspackText))

  if (props.has('vite')) {
    bundleEntries.push(propertyText('vite', codeOf(code, props.get('vite')?.value)))
  }

  addNamespace(
    'bundle',
    mergeNamespaceText({
      code,
      existing: props.get('bundle')?.value,
      entries: bundleEntries,
    }),
  )

  const sourceEntries: string[] = []
  if (props.has('define')) {
    sourceEntries.push(propertyText('define', codeOf(code, props.get('define')?.value)))
  }
  const resolveValue = props.get('resolve')?.value
  if (isObjectExpression(resolveValue)) {
    const resolveProps = readObjectProperties(resolveValue, diagnostics)
    if (resolveProps.has('alias')) {
      sourceEntries.push(propertyText('alias', codeOf(code, resolveProps.get('alias')?.value)))
    }
    if (resolveProps.has('extensions')) {
      sourceEntries.push(
        propertyText('extensions', codeOf(code, resolveProps.get('extensions')?.value)),
      )
    }
  } else if (resolveValue) {
    diagnostics.push({
      level: 'warning',
      message: 'resolve 不是对象字面量，无法自动拆分为 source.alias/source.extensions。',
      location:
        typeof resolveValue.start === 'number' && typeof resolveValue.end === 'number'
          ? { start: resolveValue.start, end: resolveValue.end }
          : undefined,
    })
  }

  addNamespace(
    'source',
    mergeNamespaceText({
      code,
      existing: props.get('source')?.value,
      entries: sourceEntries,
    }),
  )

  const devEntries: string[] = []
  const serverValue = props.get('server')?.value
  if (serverValue) {
    if (isObjectExpression(serverValue)) {
      const serverProps = readObjectProperties(serverValue, diagnostics)
      for (const [name, prop] of serverProps) {
        devEntries.push(propertyText(name, codeOf(code, prop.value)))
      }
    } else {
      devEntries.push(`...(${codeOf(code, serverValue)})`)
    }
  }
  if (props.has('enablePages')) {
    devEntries.push(propertyText('pages', codeOf(code, props.get('enablePages')?.value)))
  }

  addNamespace(
    'dev',
    mergeNamespaceText({
      code,
      existing: props.get('dev')?.value,
      entries: devEntries,
    }),
  )

  const outputEntriesFromBuild: string[] = []
  const buildEntries = createObjectEntriesFromObjectExpression({
    code,
    source: props.get('build')?.value,
    rename: {
      outDirName: 'dir',
      outReport: 'report',
      dependencyCycleCheck: 'checkCycles',
    },
    diagnostics,
  })
  if (buildEntries) {
    outputEntriesFromBuild.push(...buildEntries)
  } else if (props.has('build')) {
    diagnostics.push({
      level: 'warning',
      message: 'build 不是对象字面量，无法自动迁移为 output；请人工处理。',
      location:
        typeof props.get('build')?.start === 'number' &&
        typeof props.get('build')?.end === 'number'
          ? {
              start: props.get('build')!.start!,
              end: props.get('build')!.end!,
            }
          : undefined,
    })
  }

  addNamespace(
    'output',
    mergeNamespaceText({
      code,
      existing: props.get('output')?.value,
      entries: outputEntriesFromBuild,
    }),
  )

  for (const field of V3_NAMESPACE_FIELDS) {
    if (
      props.has(field) &&
      !outputEntries.some((entry) => entry.startsWith(`${field}: `))
    ) {
      outputEntries.push(propertyText(field, codeOf(code, props.get(field)?.value)))
    }
  }

  for (const [name, prop] of props) {
    if (
      LEGACY_TOP_LEVEL_FIELDS.has(name) ||
      RETAINED_TOP_LEVEL_FIELDS.includes(
        name as (typeof RETAINED_TOP_LEVEL_FIELDS)[number],
      ) ||
      V3_NAMESPACE_FIELDS.includes(name as (typeof V3_NAMESPACE_FIELDS)[number])
    ) {
      continue
    }

    outputEntries.push(propertyText(name, codeOf(code, prop.value)))
    diagnostics.push({
      level: 'warning',
      message: `保留未知字段 ${name}，v3 schema 可能仍会拒绝该字段。`,
      location:
        typeof prop.start === 'number' && typeof prop.end === 'number'
          ? { start: prop.start, end: prop.end }
          : undefined,
    })
  }

  const indent = inferIndent(code, node)
  const childIndent = `${indent}  `
  const text =
    outputEntries.length === 0
      ? '{}'
      : `{\n${outputEntries.map((entry) => `${childIndent}${entry},`).join('\n')}\n${indent}}`

  diagnostics.push({
    level: 'info',
    message: '已将 v2 顶层字段迁移到 v3 语义配置结构。',
    location:
      typeof node.start === 'number' && typeof node.end === 'number'
        ? { start: node.start, end: node.end }
        : undefined,
  })

  return { text, diagnostics, changed: true }
}

function inferIndent(code: string, node: AstNode): string {
  if (typeof node.start !== 'number') return ''
  const lineStart = code.lastIndexOf('\n', node.start)
  if (lineStart < 0) return ''
  const match = code.slice(lineStart + 1, node.start).match(/^\s*/)
  return match?.[0] ?? ''
}

function unwrapDefineConfig(node: AstNode | undefined): AstNode | undefined {
  if (!node) return undefined
  if (node.type !== 'CallExpression') return node
  const callee = node.callee as AstNode | undefined
  if (callee?.type !== 'Identifier' || callee.name !== 'defineConfig') {
    return node
  }
  const args = Array.isArray(node.arguments) ? node.arguments : []
  return args[0] as AstNode | undefined
}

function collectReturnedObjects(node: AstNode | undefined): ObjectExpressionNode[] {
  if (!node) return []
  const objects: ObjectExpressionNode[] = []

  const visit = (item: unknown) => {
    if (!isNode(item)) return

    if (item.type === 'ReturnStatement') {
      const argument = item.argument as AstNode | undefined
      const unwrapped = unwrapDefineConfig(argument)
      if (isObjectExpression(unwrapped)) {
        objects.push(unwrapped)
      }
    }

    for (const value of Object.values(item)) {
      if (!value || typeof value !== 'object') continue
      if (Array.isArray(value)) {
        for (const child of value) visit(child)
      } else {
        visit(value)
      }
    }
  }

  visit(node)
  return objects
}

function findConfigObjects(program: AstNode): {
  objects: ObjectExpressionNode[]
  diagnostics: MigrateConfigDiagnostic[]
} {
  const objects: ObjectExpressionNode[] = []
  const diagnostics: MigrateConfigDiagnostic[] = []
  const body = Array.isArray(program.body) ? program.body : []

  for (const item of body) {
    if (!isNode(item) || item.type !== 'ExportDefaultDeclaration') {
      continue
    }

    const declaration = unwrapDefineConfig(item.declaration as AstNode | undefined)
    if (isObjectExpression(declaration)) {
      objects.push(declaration)
      continue
    }

    if (
      declaration?.type === 'ArrowFunctionExpression' &&
      isObjectExpression(declaration.body)
    ) {
      objects.push(declaration.body)
      continue
    }

    if (
      declaration?.type === 'FunctionDeclaration' ||
      declaration?.type === 'FunctionExpression' ||
      declaration?.type === 'ArrowFunctionExpression'
    ) {
      objects.push(...collectReturnedObjects(declaration.body as AstNode))
      continue
    }

    diagnostics.push({
      level: 'warning',
      message: '默认导出不是静态对象、defineConfig 对象或返回对象的函数，无法自动迁移。',
      location:
        typeof item.start === 'number' && typeof item.end === 'number'
          ? { start: item.start, end: item.end }
          : undefined,
    })
  }

  return { objects, diagnostics }
}

export function migrateConfigSource(
  code: string,
  filePath = 'ikaros.config.ts',
): MigrateConfigResult {
  const ast = parseSync(filePath, code, {
    sourceType: 'module',
    lang:
      filePath.endsWith('.ts') ||
      filePath.endsWith('.mts') ||
      filePath.endsWith('.cts')
        ? 'ts'
        : 'js',
  })

  const diagnostics: MigrateConfigDiagnostic[] = []
  if (ast.errors.length > 0) {
    return {
      code,
      changed: false,
      diagnostics: [
        {
          level: 'error',
          message: `配置解析失败：${ast.errors[0]?.message ?? 'unknown parse error'}`,
        },
      ],
    }
  }

  const { objects, diagnostics: findDiagnostics } = findConfigObjects(
    ast.program as unknown as AstNode,
  )
  diagnostics.push(...findDiagnostics)

  if (objects.length === 0) {
    diagnostics.push({
      level: 'warning',
      message: '未找到可自动迁移的配置对象。',
    })
    return { code, changed: false, diagnostics }
  }

  const magic = new MagicString(code)
  let changed = false

  for (const object of objects) {
    const result = transformConfigObject(code, object)
    diagnostics.push(...result.diagnostics)
    if (
      result.changed &&
      typeof object.start === 'number' &&
      typeof object.end === 'number'
    ) {
      magic.overwrite(object.start, object.end, result.text)
      changed = true
    }
  }

  return {
    code: changed ? magic.toString() : code,
    changed,
    diagnostics,
  }
}

export async function migrateConfigFile(
  params: MigrateConfigFileParams,
): Promise<MigrateConfigFileResult> {
  const context = params.context ?? process.cwd()
  const inputFile = isAbsolute(params.configFile)
    ? params.configFile
    : resolve(context, params.configFile)
  const code = await fsp.readFile(inputFile, 'utf8')
  const result = migrateConfigSource(code, inputFile)

  let outputFile: string | undefined
  if (params.write || params.output) {
    outputFile = params.output
      ? isAbsolute(params.output)
        ? params.output
        : resolve(context, params.output)
      : inputFile
    await fsp.mkdir(dirname(outputFile), { recursive: true })
    await fsp.writeFile(outputFile, result.code)
  }

  return {
    ...result,
    inputFile,
    outputFile,
  }
}
